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

const providers = require('../providers/index');
const constants = require('../constants');
const aliases = require('../aliases');
const repoConfig = require('../repo-config');

const moment = require('moment-timezone');
const log = require('winston');

const {URL} = require('url');

const processBasicUsage = require('../util/basic-usage-processor');

module.exports = async function assembleManifest(buildContext, oldManifest) {
    const {config, cdnHost} = buildContext;
    log.info('Assembling new manifest from config:', JSON.stringify(config, null, 2));
    let libs = await Promise.all(Object.entries(config.libraries).map(async function ([id, defn]) {
        return [id, await loadLib(buildContext, id, defn, cdnHost, oldManifest.libraries[id])];
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

function refMustBePreserved(version) {
    return version.type === 'release';
}

async function loadLib(buildContext, id, defn, cdnHost, oldLib) {
    if (!oldLib) oldLib = {versions: []};
    log.debug(`Loading library ${id}`);
    const cdnBase = 'https://' + cdnHost;

    let provider = providers.getProvider(defn.source, defn.configuration);

    let mainConfig = Object.assign({show_in_directory: true}, defn.configuration, await provider.fetchMainConfig());

    let refs = await provider.listRefs();

    const versionNames = [...new Set([
        ...refs.map(it => it.name),
        ...oldLib.versions.filter(refMustBePreserved).map(it => it.name)
    ])];

    const versions = await Promise.all(versionNames.map(
        name => {
            const ref = refs.find(it => it.name === name);
            const oldRef = oldLib.versions.find(it => it.name === name);
            if (ref) {
                return refToVersion(id, defn, mainConfig, ref, cdnBase);
            } else if (oldRef) {
                buildContext.messages.warning({
                    message: `${id} - protected ref ${oldRef.ref} was removed from ${oldLib.source}, but will not be removed from the CDN.`
                });
                oldRef.missing_source = true;
                return oldRef;
            } else {
                // We shouldn't ever get here
                throw `Unable to find ref ${id}@${name}`;
            }
        }));

    const libAliases = aliases(versionNames);

    versions.forEach(version => {
        version.aliases = buildVersionAliases(id, defn, version.name, libAliases);
    });

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
        aliases: libAliases,
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

async function refToVersion(libId, libDefn, libConfig, ref, cdnBase) {
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

function buildVersionAliases(libId, lib, verName, aliases) {
    let redirect = true;
    let cacheImmutable = false;

    if (lib.configuration && lib.configuration.aliases) {
        const aliasConfig = lib.configuration.aliases;

        if (aliasConfig.redirect === false) {
            redirect = false;
        }
        if (aliasConfig.cache && aliasConfig.cache.immutable) {
            cacheImmutable = true;
        }
    }

    return Object.entries(aliases)
        .filter(([alias, ref]) => verName === ref)
        .reduce((obj, [alias, ref]) => {
            obj[alias] = {
                path: `/${libId}/${alias}/`,
                redirect,
                cache_immutable: cacheImmutable
            };
            return obj;
        }, {});
}

