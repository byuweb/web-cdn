/*
 *  @license
 *    Copyright 2017 Brigham Young University
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

const manifests = require('./manifest');
const scan = require('./util/scan-files');
const path = require('path');
const zlib = require('zlib');
const {promisify} = require('util');
const util = require('./util/util');
const constants = require('./constants');
const moment = require('moment-timezone');
const mime = require('mime');

const gzip = promisify(zlib.gzip);

module.exports = async function buildFilesystemMeta(manifest, assembledDir) {
    return manifests.promiseLibraries(manifest, async function (id, lib) {
        let libDir = path.join(assembledDir, id);

        const result = {};

        for (let ver of lib.versions) {
            let verDir = path.join(libDir, ver.name);
            try {
                await fs.access(verDir);
            } catch (err) {
                continue;
            }
            const filesAndDirs = await scan(verDir, {filter: f => !f.includes('.cdn-meta')});
            const files = filesAndDirs.filter(f => f.stats.isFile());
            files.forEach(f => {
                f.relative = path.relative(verDir, f.path);
            });
            const resources = await files.reduce(async function (agg, f) {
                let nextAgg = await agg;
                nextAgg[f.relative] = await fileSummary(f);
                return nextAgg;
            }, {});

            const groups = groupResources(resources);

            let versionManifest = {
                '$manifest-spec': "2",
                '$cdn-version': constants.CDN.VERSION,
                '$built': moment().tz('America/Denver').format(),
                resources,
                resource_groups: groups,
            };

            // TODO: Move this to the proper location (upload-files).
            const metaDir = path.join(verDir, '.cdn-meta');

            await fs.ensureDir(metaDir);
            await fs.writeJson(path.join(metaDir, 'version-manifest.json'), versionManifest, {spaces: 2});

            result[ver.name] = versionManifest;
        }
        return result;
    });
};

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
    // const groups = [];

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

