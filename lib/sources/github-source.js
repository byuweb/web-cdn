/**
 * Created by ThatJoeMoore on 1/20/17.
 */
"use strict";

const util = require('./../util');
const constants = require('./../constants');
const ghAuth = require('./../github/github-auth');
const ghClient = require('./../github/github-client');
const httpClient = require('../http/client');
const log = require('winston');
const yaml = require('node-yaml');
const moment = require('moment');


const http = ghAuth().then(auth => {
    return httpClient({authorization: auth})
});
const reqp = function() {
    let args = arguments;
    return http.then(clients => clients.promise.apply(this, args));
};

const fs = require('fs');

function ghapi(githubInfo, path) {
    return `https://api.github.com/repos/${githubInfo.owner}/${githubInfo.repo}/${path}`;
}

// import ApolloClient, { createNetworkInterface } from 'apollo-client';

/**
 * @type SourceFunctions
 */
module.exports = {

    id: constants.SOURCE_KEYS.GITHUB,

    /**
     *
     * @param {string} sourceString
     * @param {{}} options
     * @returns {githubInfo}
     */
    parseSourceInfo(sourceString, options) {
        let [owner, repo] = sourceString.split('/');
        return {
            full: this.id + ':' + sourceString,
            type: constants.SOURCE_KEYS.GITHUB,
            owner: owner,
            repo: repo
        };
    },

    /**
     * @typedef {{owner: string, repo: string}} githubInfo
     * @augments SourceInfo
     */

    /**
     * @typedef {{name: string, ref: string, tarballUrl: string, commitSha: string, viewUrl: string}} refInfo
     */

    /**
     * @param {!githubInfo} ghInfo
     * @return {Promise.<{tags: refInfo, branches: refInfo}>}
     */
    listRefs(ghInfo) {
        let branches = reqp(ghapi(ghInfo, 'branches'))
            .then(branches =>
                Promise.all(branches.map(each => {
                    let name = each.name;
                    let sha = each.commit.sha;
                    return _getCommitDate(sha)
                        .then(date => {
                            return {
                                name: util.cleanRefName(name),
                                ref: name,
                                tarballUrl: ghapi(ghInfo, `tarball/${name}`),
                                commitSha: sha,
                                viewUrl: `https://github.com/${ghInfo.owner}/${ghInfo.repo}/tree/${name}`,
                                lastUpdate: date
                            };
                        });
                }))
            );
        let tags = reqp(ghapi(ghInfo, 'tags'))
            .then(tags =>
                Promise.all(tags.map(each => {
                    let name = each.name;
                    let sha = each.commit.sha;
                    return _getCommitDate(sha)
                        .then(date => {
                            return {
                                name: util.cleanRefName(name),
                                ref: name,
                                tarballUrl: each.tarball_url,
                                commitSha: sha,
                                viewUrl: `https://github.com/${ghInfo.owner}/${ghInfo.repo}/tree/${name}`,
                                lastUpdate: date
                            };
                        });
                }))
            );
        return Promise.all([branches, tags])
            .then(results => {
                return {
                    branches: results[0],
                    tags: results[1]
                };
            });

        function _getCommitDate(commit) {
            return reqp(ghapi(ghInfo, `git/commits/${commit}`))
                .then(commit => {
                    let author = commit.author.date;
                    let committer = commit.committer.date;

                    return moment.max(moment(author), moment(committer));
                });
        }
    },

    /**
     * @param {!githubInfo} ghInfo
     * @param {!Version} ref
     * @param {!string} dest
     * @returns {Promise}
     */
    downloadTarball(ghInfo, ref, dest) {
        return ghClient.downloadTarball(
            ghInfo.owner, ghInfo.repo, ref.ref, dest
        );
    },

    /**
     *
     * @param {githubInfo} ghInfo
     * @param {string} ref
     * @returns {Promise.<RepoConfig>}
     */
    fetchRepoConfig(ghInfo, ref) {
        log.debug(`getting repo config for ${ghInfo.full}@${ref}`);
        return ghClient.getFileContents(ghInfo.owner, ghInfo.repo, ref, '.cdn-config.yml')
            .then(yaml.parse)
            .catch(err => {
                log.warn('error getting repo config for', ghInfo.full, ref, err);
                return null;
            });
    }

};

