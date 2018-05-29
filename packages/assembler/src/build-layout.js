/*
 *  @license
 *    Copyright 2018 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

"use strict";

const fs = require('fs-extra');
const {promisify} = require('util');
const path = require('path');
const zlib = require('zlib');
const brotli = require('iltorb');
const mime = require('mime');
const moment = require('moment-timezone');

const gzip = promisify(zlib.gzip);

const sets = require('./util/sets');
const globs = require('./util/globs');
const constants = require('./constants');
const providers = require('./providers');
const util = require('./util/util');

const log = require('winston');

module.exports = async function buildLayout(oldManifest, newManifest, actions, sourceDirs, cdnHost) {
    const files = [];

    const sizeCache = {};

    for (const [libId, lib] of Object.entries(newManifest.libraries)) {
        let libSource = sourceDirs[libId];

        let libActions = actions[libId];

        let versionsToCopy = sets.union(libActions.add, libActions.update);

        if (versionsToCopy === 0) {
            return;
        }

        const aliasesReversed = invertMap(lib.aliases);


        const provider = providers.getProvider(lib.source, lib.lib_config);

        for (const verId of versionsToCopy) {
            log.debug(`Processing ${libId}@${versionsToCopy}`);
            let ver = lib.versions.find(v => v.name === verId);
            let srcDir = libSource[ver.ref];
            const verPrefix = prefixFor(libId, ver);

            const versionFiles = [];

            const cacheControl = cacheControlFor(libId, ver);
            const aliasCacheControl = aliasCacheControlFor(libId, ver);

            for (let r of ver.config.resources) {
                log.debug(`${libId}@${versionsToCopy} Processing resources at ${r.src}`);
                let dest = r.dest ? path.join(verPrefix, r.dest) : verPrefix;

                if (isSuspiciousPath(srcDir, r.src)) {
                    throw Error(`Suspicious path pattern '${r.src}' in ${libId}@${verId}`);
                }

                let renameRules = (r.rename || []).map(rule => {
                    let {regex: from, to} = rule;
                    return {regex: new RegExp(from), to};
                });

                let globMatch = globs.match(r.src, {cwd: srcDir, root: srcDir, nodir: true});

                let globBase = globMatch.base;

                let toMove = await globMatch;

                let moves = toMove.map(name => {
                    let from = path.join(srcDir, name);
                    let toBase = name.replace(globBase, "");
                    let to = path.join(dest, toBase);

                    let renames = renameRules.filter(r => {
                        return toBase.match(r.regex);
                    });
                    if (renames.length === 0) {
                        return [{
                            name: toBase,
                            from,
                            to
                        }];
                    } else {
                        return renames.map(r => {
                            const renamed = toBase.replace(r.regex, r.to);
                            return {
                                name: renamed,
                                from,
                                to: path.join(dest, renamed)
                            }
                        });
                    }
                }).reduce((acc, each) => {
                    return each.concat(acc || []);
                });

                const mapped = await Promise.all(moves.map(async (it) => {
                    const from = it.from;
                    const type = mimeTypeFor(from);
                    const stats = await fs.stat(from);
                    const content = await fs.readFile(from);

                    const hashes = hashesFor(content, ['sha256', 'sha384', 'sha512']);

                    const sha256 = hashes.sha256.hex;

                    let gzipped, brotlied;

                    log.debug('Start zipping', from);
                    if (sha256 in sizeCache) {
                        [gzipped, brotlied] = await sizeCache[sha256];
                    } else {
                        const promise = sizeCache[sha256] = Promise.all([
                            await gzip(content),
                            await brotli.compress(content, {mode: brotliModeFor(type)})
                        ]);
                        [gzipped, brotlied] = await promise;
                    }
                    log.debug('Finished zipping');

                    return {
                        name: it.name,
                        contentPath: from,
                        cdnPath: it.to,
                        type,
                        size: {
                            unencoded: stats.size,
                            gzip: gzipped.length,
                            br: brotlied.length,
                        },
                        hashes,
                        meta: {
                            cacheControl: cacheControl,
                            headers: {
                                'Timing-Allow-Origin': '*',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Methods': 'GET, HEAD',
                                'Access-Control-Max-Age': '86400',
                                'X-CDN-Ver': `${ver.type} ${ver.ref} ${ver.source_sha.substr(0, 10)}`
                                //TODO: Put awesomeness like 'Link' here
                            },
                            tags: {
                                'CDN-Version-Ref': ver.ref,
                                'CDN-Version-Type': ver.type,
                                'CDN-Version-Sha': ver.source_sha,
                            }
                        },
                    }
                }));

                versionFiles.push(...mapped);
            }

            log.debug('Fetching Readme');
            const readme = await provider.fetchReadme(ver.ref);

            log.debug('Calculating meta files');
            const metaFiles = getMetaFiles(libId, ver, verPrefix, versionFiles, readme, cacheControl);

            versionFiles.push(...metaFiles);

            files.push(...versionFiles);

            const aliases = aliasesReversed[verId];

            if (aliases) {
                aliases.forEach(alias => {
                    const aliasPrefix = `${libId}/${alias}/`;

                    const aliasFiles = versionFiles.map(file => {
                        return {
                            name: file.name,
                            cdnPath: aliasPrefix + file.name,
                            type: file.type,
                            meta: {
                                cacheControl: aliasCacheControl,
                                redirect: {
                                    status: 302,
                                    location: '/' + file.cdnPath
                                },
                                headers: file.meta.headers,
                                tags: Object.assign({}, file.tags, {
                                    'CDN-Alias': alias
                                })
                            }
                        };
                    });

                    files.push(...aliasFiles);

                });
            }
        }
    }

    files.forEach(it => {
       let sha = 'empty';
       if (it.hashes) {
           sha = it.hashes.sha512.hex;
       } else if (it.contents) {
           sha = util.hash('sha512', Buffer.from(it.contents));
       }
       it.fileSha512 = sha;
    });

    return files;
};

function invertMap(object) {
    return Object.entries(object).reduce((inverted, [alias, target]) => {
        let array = inverted[target];
        if (!array) {
            array = inverted[target] = [];
        }
        array.push(alias);
        return inverted;
    }, {});
}

function getMetaFiles(libId, ver, prefix, versionFiles, readme, cacheControl) {
    const files = [];
    const metaDir = `${prefix}.cdn-meta/`;
    let readmePath = undefined;
    if (readme) {
        readmePath = metaDir + readme.filename;

        files.push({
            name: '.cdn-meta/' + readme.filename,
            cdnPath: readmePath,
            type: mimeTypeFor(readme.filename),
            contents: readme.content,
            meta: {
                cacheControl,
                headers: {
                    'Timing-Allow-Origin': '*',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD',
                    'Access-Control-Max-Age': '86400',
                    'X-CDN-Ver': `${ver.type} ${ver.ref} ${ver.source_sha.substr(0, 10)}`
                },
                tags: {
                    'CDN-Version-Ref': ver.ref,
                    'CDN-Version-Type': ver.type,
                    'CDN-Version-Sha': ver.source_sha,
                }
            }
        });
    }
    const resources = versionFiles
        .sort((one, two) => one.name.localeCompare(two.name))
        .reduce((acc, it) => {
            acc[it.name] = {
                type: it.type,
                size: it.size,
                hashes: it.hashes
            };
            return acc;
        }, {});

    const resourceGroups = groupResources(resources);

    const manifestContents = {
        '$manifest-spec': '2',
        '$cdn-version': constants.CDN.version,
        '$built': moment().tz('America/Denver').format(),
        resources,
        resource_groups: resourceGroups,
        readme_path: readmePath
    };

    files.push({
        name: '.cdn-meta/version-manifest.json',
        cdnPath: metaDir + 'version-manifest.json',
        type: 'application/json',
        contents: JSON.stringify(manifestContents),
        meta: {
            cacheControl,
            headers: {
                'Timing-Allow-Origin': '*',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD',
                'Access-Control-Max-Age': '86400',
                'X-CDN-Ver': `${ver.type} ${ver.ref} ${ver.source_sha.substr(0, 10)}`
            },
            tags: {
                'CDN-Version-Ref': ver.ref,
                'CDN-Version-Type': ver.type,
                'CDN-Version-Sha': ver.source_sha,
            }
        }
    });

    return files;
}


function cacheControlFor(libId, version) {
    if (version.type === 'release') {
        return 'public, max-age=31557600, s-maxage=31557600, immutable';
    } else {
        return 'public, max-age=300, s-maxage=300';
    }
}

function aliasCacheControlFor(libId, version) {
    if (version.type === 'release') {
        return 'public, max-age=3600, s-maxage=300';
    } else {
        return 'public, max-age=60, s-maxage=0';
    }
}


const textPrefixes = [
    'application/javascript',
    'text/css',
    'text/plain',
    'text/javascript',
];

const textSuffixes = [
    '+json',
    '+xml'
];

function brotliModeFor(mimeType) {
    if (isTextMime(mimeType)) {
        return 1;
    } else if (mimeType.startsWith('font')) {
        return 2;
    }
    return 0;
}

function isTextMime(type) {
    if (textPrefixes.some(it => type.startsWith(it))) {
        return true;
    }
    return textSuffixes.some(it => type.endsWith(it));
}

function isSuspiciousPath(base, pathOrPattern) {
    if (path.isAbsolute(pathOrPattern)) {
        return true;
    }
    let norm = path.normalize(path.join(base, pathOrPattern));
    return norm.indexOf(base) !== 0;
}


async function fileSummary(file) {
    let path = file.path;
    let stat = file.stats;

    let content = await fs.readFile(path);

    let gzipped = await gzip(content);

    return {
        type: mimeTypeFor(file.path),
        size: stat.size,
        gzip_size: gzipped.length,
        hashes: hashesFor(content, ['sha256', 'sha384', 'sha512'])
    };
}

function mimeTypeFor(file) {
    return mime.getType(file) || 'unknown';
}

function hashesFor(content, algos) {
    return algos.reduce((agg, each) => {
        agg[each] = util.hash(each, content);
        return agg;
    }, {});
}


function groupResources(resources) {
    const groups = Object.keys(resources).map(file => {
        const variant = getVariant(file);
        if (variant) {
            return {file, base: variant.base, variant: variant.id};
        } else {
            return {file, base: file};
        }
    }).reduce((agg, {file, base, variant}) => {
        let group = agg[base];
        if (!group) {
            group = agg[base] = {
                base_file: base,
                variants: {}
            }
        }
        if (variant) {
            group.variants[variant] = file;
        }
        return agg;
    }, {});

    return Object.values(groups);
}

const FILE_VARIANTS = [
    {
        id: "min",
        pattern: /\.min\.([a-z]+)$/
    },
    {
        id: "min-sourcemap",
        pattern: /\.min\.([a-z]+).map$/
    },
    {
        id: "sourcemap",
        pattern: /\.([a-z]+)\.map$/
    }
];

function getVariant(file) {
    const variant = FILE_VARIANTS.find(v => v.pattern.test(file));
    if (!variant) {
        return null;
    }
    const base = file.replace(variant.pattern, "") + "." + file.match(variant.pattern)[1];

    return {
        base,
        id: variant.id,
    };
}

function prefixFor(libId, version) {
    return `${libId}/${versionPath(version)}/`;
}

function versionPath(version) {
    return version.type === 'branch' ? `experimental/${version.name}` : version.name;
}

