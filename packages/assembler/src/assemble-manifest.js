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

const providers = require('./providers');
const constants = require('./constants');
const aliases = require('./aliases');
const repoConfig = require('./repo-config');

const moment = require('moment-timezone');
const log = require('winston');

module.exports = async function assembleManifest(mainConfig) {
    log.info('Assembling new manifest from config:', JSON.stringify(mainConfig, null, 2));
    let libs = await Promise.all(Object.entries(mainConfig.libraries).map(async function ([id, defn]) {
        return [id, await loadLib(id, defn)];
    }));

    let libraries = {};
    libs.sort(([id1, lib1], [id2, lib2]) => id1.localeCompare(id2))
        .forEach(([id, lib]) => libraries[id] = lib);

    log.info('Finished assembling new manifest');
    return {
        '$cdn-version': constants.CDN.VERSION,
        '$manifest-spec': constants.CDN.MANIFEST_SPEC,
        '$built': moment().tz('America/Denver').format(),
        libraries
    };
};

async function loadLib(id, defn) {
    log.debug(`Loading library ${id}`);
    let provider = providers.getProvider(defn.source, defn.configuration);

    let refs = await provider.listRefs();

    refs.forEach(r => r.config = repoConfig.normalize(r.config));

    let mainConfig = await provider.fetchMainConfig();

    log.debug(`Finished library ${id}`);
    let libDefinition = {
        source: defn.source,
        name: mainConfig.name,
        description: mainConfig.description,
        type: mainConfig.type || 'unknown',
        aliases: aliases(refs.map(it => it.name)),
        versions: refs,
        links: await provider.fetchLinks(mainConfig),
    };

    if (defn.configuration) {
        libDefinition.lib_config = defn.configuration;
    }

    return libDefinition;
}

