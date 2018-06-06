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
const brotli = require('iltorb');
const mime = require('mime');
const moment = require('moment-timezone');
const deepcopy = require('deepcopy');

const zlib = require('zlib');
const gzipIt = promisify(zlib.gzip);

const sets = require('./util/sets');
const globs = require('./util/globs');
const constants = require('./constants');
const providers = require('./providers');
const util = require('./util/util');

const log = require('winston');

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31557600, s-maxage=31557600, immutable';
const CACHE_CONTROL_FIVE_MINUTES = 'public, max-age=300, s-maxage=300';
const CACHE_CONTROL_ONE_HOUR = 'public, max-age=3600, s-maxage=900';
const CACHE_CONTROL_ONE_MINUTE = 'public, max-age=60, s-maxage=0';

const REDIRECTS_PATH = '/.cdn-meta/redirects.txt';

module.exports = async function buildLayout(oldManifest, newManifest, actions, sourceDirs, cdnHost) {
    const files = [];

    for (const [libId, lib] of Object.entries(newManifest.libraries)) {
        let libSource = sourceDirs[libId];

        let libActions = actions[libId];

        let versionsToCopy = sets.union(libActions.add, libActions.update);

        if (versionsToCopy === 0) {
            return;
        }

        const provider = providers.getProvider(lib.source, lib.lib_config);

        for (const verId of versionsToCopy) {
            let ver = lib.versions.find(v => v.name === verId);
            files.push(...await filesForVersion(provider, libId, lib, verId, ver, libSource[ver.ref]))
        }
    }

    files.push(getRedirectFile(newManifest));

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

function getRedirectFile(newManifest) {
    const redirects = redirectList(newManifest);

    const contents = redirects
        .map(it => `${it.type}\t${it.from}\t${it.to}\t${it.status}\t${it.cache}`)
        .join('\n');

    return {
            name: REDIRECTS_PATH,
            cdnPath: REDIRECTS_PATH,
            type: 'text/plain',
            contents,
            meta: {
                CACHE_CONTROL_ONE_HOUR,
                headers: {
                    'Timing-Allow-Origin': '*',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD',
                    'Access-Control-Max-Age': '86400',
                },
            }
        }
}

async function computeMovesForResources(libId, verId, ver, verPrefix, srcDir, resource) {
    log.debug(`${libId}@${verId} Processing resources at ${resource.src}`);
    let dest = resource.dest ? path.join(verPrefix, resource.dest) : verPrefix;

    if (isSuspiciousPath(srcDir, resource.src)) {
        throw Error(`Suspicious path pattern '${resource.src}' in ${libId}@${verId}`);
    }

    let renameRules = (resource.rename || []).map(rule => {
        let {regex: from, to} = rule;
        return {regex: new RegExp(from), to};
    });

    let globMatch = globs.match(resource.src, {cwd: srcDir, root: srcDir, nodir: true});

    let globBase = globMatch.base;

    let toMove = await globMatch;

    return flatMap(toMove, name => {
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
    });
}

function flatMap(array, func) {
    return array.map(func).reduce((acc, it) => acc.concat(it), []);
}

async function filesForVersion(provider, libId, lib, verId, ver, srcDir) {
    log.debug(`Processing ${libId}@${verId}`);
    const verPath = ver.path;

    const sourceFiles = [];

    const cacheControl = cacheControlFor(libId, ver);

    for (let r of ver.config.resources) {
        const sources = await computeMovesForResources(libId, verId, ver, verPath, srcDir, r);

        sourceFiles.push(...sources);
    }

    const versionFiles = await Promise.all(sourceFiles.map(async (it) => {
        return processSourceFile(ver, it, cacheControl)
    }));

    log.debug('Fetching Readme');
    const readme = await provider.fetchReadme(ver.ref);

    log.debug('Calculating meta files');
    const metaFiles = getMetaFiles(libId, ver, verPath, versionFiles, readme, cacheControl);

    versionFiles.push(...metaFiles);

    const aliasFiles = processVersionAliasFiles(libId, lib, ver, verPath, versionFiles);

    return versionFiles.concat(aliasFiles);
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

async function processSourceFile(ver, file, cacheControl) {
    const from = file.from;
    const type = mimeTypeFor(from);
    const content = await fs.readFile(from);

    const hashes = hashesFor(content, ['sha256', 'sha384', 'sha512']);

    const sha256 = hashes.sha256.hex;

    const size = await getSizeFor(content, type, sha256);

    return {
        name: file.name,
        contentPath: from,
        cdnPath: file.to,
        type,
        size,
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
}

function processVersionAliasFiles(libId, lib, ver, verPrefix, verFiles) {
    let defaultCacheControl = aliasCacheControlFor(libId, ver);
    return flatMap(Object.entries(ver.aliases), ([aliasName, alias]) => {
        const aliasPrefix = alias.path;
        const redirect = alias.redirect;
        const cacheControl = alias.cache_immutable ? CACHE_CONTROL_IMMUTABLE : defaultCacheControl;

        return verFiles.map(file => {
            const copy = deepcopy(file);
            copy.cdnPath = aliasPrefix + file.name;
            copy.meta.cacheControl = cacheControl;

            copy.meta.tags = Object.assign({}, file.tags, {
                'CDN-Alias': aliasName
            });

            if (redirect) {
                copy.meta.redirect = {
                    status: 302,
                    location: '/' + file.cdnPath
                };
                delete copy.contentPath;
                copy.contents = '';
            }
            return copy;
        });
    });
}

function cacheControlFor(libId, version) {
    if (version.type === 'release') {
        return CACHE_CONTROL_IMMUTABLE;
    } else {
        return CACHE_CONTROL_FIVE_MINUTES;
    }
}

function aliasCacheControlFor(libId, version) {
    if (version.type === 'release') {
        return CACHE_CONTROL_ONE_HOUR;
    } else {
        return CACHE_CONTROL_ONE_MINUTE;
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

function redirectList(newManifest) {
    return flatMap(Object.entries(newManifest.libraries), ([libId, lib]) => {
        return flatMap(lib.versions, version => {
            const aliasCache = aliasCacheControlFor(libId, version);
            return Object.entries(version.aliases)
                .filter(([aliasName, alias]) => alias.redirect)
                .map(([aliasName, alias]) => {
                    return {
                        type: 'prefix',
                        from: alias.path,
                        to: version.path,
                        status: 302,
                        cache: aliasCache
                    }
                });
        });
    });
}

const sizeCache = {};

async function getSizeFor(content, type, sha) {
    if (sha in sizeCache) {
        return sizeCache[sha];
    }
    const compressible = isTextMime(type);
    const unencoded = content.length;

    let gzip, br;

    if (compressible) {
        gzip = (await gzipIt(content)).length;
        br = -1;
        // br = (await brotli.compress(content, {mode: brotliModeFor(type)})).length
    }

    const result = {compressible, unencoded, gzip, br};

    sizeCache[sha] = result;

    return result;
}
