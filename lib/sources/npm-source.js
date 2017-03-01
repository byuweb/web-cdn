/**
 * Created by ThatJoeMoore on 1/20/17
 */
"use strict";

const util = require('./../util');
const constants = require('./../constants');
const log = require('winston');
const yaml = require('node-yaml');
const moment = require('moment');
const semver = require('semver');

const getTarball = require('../http/get-tarball');

const RegClient = require('npm-registry-client');
const client = new RegClient();

const npmUri = 'https://registry.npmjs.org/';

const params = {timeout: 1000};


const fs = require('fs');
const fsp = require('fs-extra-p');

/**
 * @type SourceFunctions
 */
module.exports = {

    id: constants.SOURCE_KEYS.NPM,

    /**
     *
     * @param {string} sourceString
     * @param {{}} options
     * @returns {npmInfo}
     */
    parseSourceInfo(sourceString, options) {
        let name = sourceString;
        if (!options.versions) {
            throw new Error('No version information specified for ' + sourceString);
        }
        return {
            full: this.id + ':' + sourceString,
            type: constants.SOURCE_KEYS.NPM,
            name: name,
            config: options
        };
    },

    /**
     * @typedef {{name: string, config: {}}} npmInfo
     * @augments SourceInfo
     */

    /**
     * @typedef {{name: string, ref: string, tarballUrl: string, commitSha: string, viewUrl: string}} refInfo
     */

    /**
     * @param {!npmInfo} npmInfo
     * @return {Promise.<{tags: refInfo, branches: refInfo}>}
     */
    listRefs(npmInfo) {
        let versionConfig = npmInfo.config.versions;
        let ranges = Object.getOwnPropertyNames(versionConfig);

        return new Promise((resolve, reject) => {
            client.get(npmUri + npmInfo.name, params, function (error, data) {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(data)
            });
        }).then(data => {
            npmInfo.cache = data;
            let tags = util.objectAsArray(data.versions)
                .filter(pair => {
                    return ranges.some(range => semver.satisfies(pair.key, range));
                })
                .map(pair => {
                    let {key: name, value: info} = pair;
                    return {
                        name: util.cleanRefName(name),
                        ref: name,
                        tarballUrl: info.dist.tarball,
                        commitSha: info.dist.shasum,
                        viewUrl: `https://www.npmjs.com/package/${npmInfo.name}`,
                        lastUpdate: moment(data.time[name])
                    };
                });
            return {
                tags: tags,
                branches: []
            };
        });
    },

    /**
     * @param {!npmInfo} npmInfo
     * @param {!Version} ref
     * @param {!string} dest
     * @returns {Promise}
     */
    downloadTarball(npmInfo, ref, dest) {
        return getTarball(ref.tarballUrl, dest);
    },

    /**
     *
     * @param {npmInfo} npmInfo
     * @param {string} ref
     * @returns {Promise.<RepoConfig>}
     */
    fetchRepoConfig(npmInfo, ref) {
        log.debug(`getting repo config for ${npmInfo.full}@${ref}`);
        let versionPair = util.objectAsArray(npmInfo.config.versions)
            .find(pair => semver.satisfies(ref, pair.key));
        let version = versionPair.value;
        let npm = npmInfo.cache;

        let cfg = {
            name: npm.name,
            description: npm.description,
            docs: npm.homepage,
            resources: version.resources,
            entrypoints: version.entrypoints
        };

        return Promise.resolve(cfg);
    }

};


