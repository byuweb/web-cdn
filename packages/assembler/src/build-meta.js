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

const gzip = promisify(zlib.gzip);

module.exports = async function buildFilesystemMeta(manifest, assembledDir) {
    return manifests.promiseLibraries(manifest, async function (id, lib) {
        let libDir = path.join(assembledDir, id);

        for (let ver of lib.versions) {
            let verDir = path.join(libDir, ver.name);
            try {
                await fs.access(verDir);
            } catch (err) {
                continue;
            }
            let filesAndDirs = await scan(verDir, {filter: f => !f.includes('.cdn-meta')});
            let files = filesAndDirs.filter(f => f.stats.isFile());
            files.forEach(f => {
                f.relative = path.relative(verDir, f.path);
            });
            let resources = await files.reduce(async function (agg, f) {
                let nextAgg = await agg;
                nextAgg[f.relative] = await fileSummary(f);
                return nextAgg;
            }, {});

            let versionManifest = {
                '$manifest-spec': "2",
                '$cdn-version': constants.CDN.VERSION,
                '$built': moment().tz('America/Denver').format(),
                resources
            };

            const metaDir = path.join(verDir, '.cdn-meta');

            await fs.ensureDir(metaDir);
            await fs.writeJson(path.join(metaDir, 'version-manifest.json'), versionManifest, {spaces: 2});
        }
    });
};

async function fileSummary(file) {
    let path = file.path;
    let stat = file.stats;

    let content = await fs.readFile(path);

    let gzipped = await gzip(content);

    return {
        size: stat.size,
        gzip_size: gzipped.length,
        hashes: hashesFor(content, ['sha256', 'sha384', 'sha512'])
    };
}

function hashesFor(content, algos) {
    return algos.reduce((agg, each) => {
        agg[each] = util.hash(each, content);
        return agg;
    }, {});
}


