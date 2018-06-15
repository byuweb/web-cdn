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

const fsp = require('fs-extra');
const path = require('path');

const sets = require('./util/sets');
const providers = require('./providers');

module.exports = async function downloadSources(buildContext, manifest, actions) {
    // await fsp.emptyDir(workDir);
    const {workDir} = buildContext.directories;

    await fsp.ensureDir(workDir);

    let result = {};

    let promises = Object.entries(manifest.libraries).map(async function ([id, defn]) {
        let dir = path.join(workDir, id);

        let libActions = actions[id];

        let versionsToGet = sets.union(libActions.add, libActions.update);

        if (versionsToGet.size === 0) {
            return;
        }

        // await fsp.emptyDir(dir);
        await fsp.ensureDir(dir);

        let provider = providers.getProvider(defn.source, defn.lib_config);

        let refsToGet = [...versionsToGet].map(id => {
            return defn.versions.find(v => v.name === id).ref;
        });

        let libResult = {};

        result[id] = libResult;
        await Promise.all(refsToGet.map(async function(r) {
            let dest = path.join(dir, r);
            await provider.downloadRef(r, dest);
            libResult[r] = dest;
        }));
    });

    await Promise.all(promises);

    return result;
};
