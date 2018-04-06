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

const { URL } = require('url');

const processBasicUsage = require('./util/basic-usage-processor');

module.exports = async function assembleManifest(mainConfig, cdnHost) {
    log.info('Assembling new manifest from config:', JSON.stringify(mainConfig, null, 2));
    let libs = await Promise.all(Object.entries(mainConfig.libraries).map(async function ([id, defn]) {
        return [id, await loadLib(id, defn, cdnHost)];
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

async function loadLib(id, defn, cdnHost) {
    log.debug(`Loading library ${id}`);
    const cdnBase = 'https://' + cdnHost;

    let provider = providers.getProvider(defn.source, defn.configuration);

    let mainConfig = Object.assign({show_in_directory: true}, defn.configuration, await provider.fetchMainConfig());

    let refs = await provider.listRefs();

    const versions = await Promise.all(refs.map(ref => postProcessRef(id, defn, mainConfig, ref, cdnBase)));

    const deprecated = !!mainConfig.deprecated;
    let deprecationMessage = undefined;
    if (deprecated) {
        if (typeof mainConfig.deprecated === 'string') {
            deprecationMessage = mainConfig.deprecated;
        } else {
            deprecationMessage = 'This library has been deprecated';
        }
    }

    log.debug(`Finished library ${id}`);
    let libDefinition = {
        source: defn.source,
        name: mainConfig.name,
        description: mainConfig.description,
        type: mainConfig.type || 'unknown',
        aliases: aliases(versions.map(it => it.name)),
        links: await provider.fetchLinks(mainConfig),
        show_in_directory: mainConfig.show_in_directory,
        prerelease: mainConfig.prerelease,
        deprecated: deprecated,
        deprecation_message: deprecationMessage,
        basic_usage: processBasicUsage(mainConfig.basic_usage, new URL(`/${id}/latest/`, cdnBase).toString()),
        versions,
    };

    if (defn.configuration) {
        libDefinition.lib_config = defn.configuration;
    }

    return libDefinition;
}

async function postProcessRef(libId, libDefn, libConfig, ref, cdnBase) {
    const path = `/${libId}/${versionPath(ref.name, ref.type)}/`;

    const absoluteUrl = new URL(path, cdnBase).toString();

    const result = Object.assign({}, ref, {
        path,
        config: repoConfig.normalize(ref.config, libDefn.configuration),
        manifest_path: path + '.cdn-meta/version-manifest.json',
    });

    const basic_usage = processBasicUsage(ref.basic_usage, absoluteUrl);
    if (basic_usage) {
        result.basic_usage = basic_usage;
    }

    return result;
}

function versionPath(version, type) {
    return type === 'branch' ? `experimental/${version}` : version;
}

