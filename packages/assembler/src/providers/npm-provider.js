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

/**
 * Created by ThatJoeMoore on 1/20/17
 */
"use strict";

const util = require('../util/util');
const constants = require('../constants');
const log = require('winston');
const yaml = require('node-yaml');
const moment = require('moment-timezone');
const semver = require('semver');

const getTarball = require('../util/get-tarball');

const RegClient = require('npm-registry-client');
const client = new RegClient();

const npmUri = 'https://registry.npmjs.org/';

const params = { timeout: 1000 };

const httpFactory = require('../util/http');

const http = httpFactory();

const fs = require('fs');
const fsp = require('fs-extra');

module.exports = class NpmProvider {
    static get id() {
        return constants.SOURCE_KEYS.NPM;
    }

    static validateConfig(options) {
        return true;
    }

    constructor(source, libConfig) {
        this.name = source;
        if (!libConfig.versions) {
            throw new Error('No version information specified for npm:' + source);
        }
        this.config = libConfig;
    }

    async _npmData() {
        if (this._cache) {
            return this._cache;
        }
        let npmData = await npmGet(this.name);

        this._cache = npmData;
        return npmData;
    }

    async listRefs() {
        let versionConfig = this.config.versions;
        let ranges = Object.getOwnPropertyNames(versionConfig);

        let npmData = await this._npmData();

        return Object.entries(npmData.versions)
            .filter(([name, info]) => ranges.some(range => semver.satisfies(name, range)))
            .map(([name, info]) => {
                return {
                    ref: name,
                    type: constants.REF_TYPES.RELEASE,
                    name: util.cleanRefName(name),
                    source_sha: info.dist.shasum,
                    last_updated: moment(npmData.time[name]).tz('America/Denver').format(),
                    tarball_url: info.dist.tarball,
                    link: `https://www.npmjs.com/package/${this.name}`,
                    config: getVersionConfig(this.config, npmData, name),
                }
            });
    }

    async fetchRepoConfig(ref) {
        console.log('npm: fetchRepoConfig:', ref);
        let npmData = await this._npmData();

        return getVersionConfig(this.config, npmData, ref);
    }

    fetchLinks(config) {
        return {
            source: `https://www.npmjs.com/package/${this.name}`,
            issues: `https://www.npmjs.com/package/${this.name}`,
            docs: config.docs,
        };
    }

    async fetchMainConfig() {
        let npmData = await this._npmData();

        return {
            name: npmData.name,
            description: npmData.description,
            docs: npmData.homepage,
        }
    }

    async downloadRef(ref, destination) {
        await fsp.emptyDir(destination);

        log.info(`Downloading ${this.source}@${ref} to ${destination} using http`);

        let refs = await this.listRefs();

        let ver = refs.find(r => r.ref === ref);

        await getTarball(http, ver.tarball_url, destination);
    }
};

async function npmGet(uri) {
    let requestUri = assembleUri(npmUri, uri);
    return new Promise((resolve, reject) => {
        client.get(requestUri, params, (error, data) => {
            if (error) reject(error);
            else resolve(data);
        });
    });
}

function assembleUri(npmUri, target) {
    let uriPrefix = '';
    let uri = target;
    //handle scoped packages. NPM doesn't like encoded @'s
    if (uri.indexOf('@') === 0) {
        uriPrefix = '@';
        uri = uri.substring(1);
    }
    return npmUri + uriPrefix + encodeURIComponent(uri);
}

function getVersionConfig(config, npmData, ref) {
    let [range, version] = Object.entries(config.versions)
        .find(([range, cfg]) => semver.satisfies(ref, range));

    return {
        name: npmData.name,
        description: npmData.description,
        docs: npmData.homepage,
        resources: version.resources,
        entrypoints: version.entrypoints
    };
}

