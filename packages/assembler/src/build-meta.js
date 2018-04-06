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

        const result = {};

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

/*
   resourceGroups() {
      const groups = {};

      const resources = this.resources;

      for (const [id, res] of Object.entries(resources)) {
        const variant = getVariant(id);
        if (!variant) {
          const group = (groups[id] = groups[id] || {
            variants: []
          });
          group.baseFile = res;
          continue;
        }
        const { parent, details } = variant;
        const group = (groups[parent] = groups[parent] || {
          baseFile: null,
          variants: []
        });

        group.variants.push({
          variant: details,
          info: res
        });
      }

      return groups;
    }
  }
  //   mounted() {
  //       window.scrollTo(0, 0);
  //   },
};

const FILE_VARIANTS = [
  {
    id: "min",
    display: "Minified File",
    pattern: /\.min\.([a-z]+)$/
  },
  {
    id: "min-sourcemap",
    display: "Minified Source Map",
    pattern: /\.min\.([a-z]+).map$/
  },
  {
    id: "sourcemap",
    display: "Source Map",
    pattern: /\.([a-z]+)\.map$/
  }
];

function getVariant(file) {
  const variant = FILE_VARIANTS.find(v => v.pattern.test(file));
  if (!variant) {
    return null;
  }
  const parent = file.replace(variant.pattern, "") + "." + file.match(variant.pattern)[1];

  return {
    parent,
    details: variant
  };
}
 */

