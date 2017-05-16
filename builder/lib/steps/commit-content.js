"use strict";

const klaw = require('klaw');

const ghClient = require('./../github/github-client');
const constants = require('./../constants');
const path = require('path');
const log = require('winston');

/**
 *
 * @param {CdnConfig} config
 * @param {FilesystemChanges} fileChanges
 * @param {string} contentPath
 * @returns {Promise.<*>}
 */
module.exports = function commitContent(config, fileChanges, contentPath) {
    log.info('-------------- Committing File Contents --------------');

    if (config.dryRun) {
        log.info('Dry run; skipping commit');
        return Promise.resolve();
    }

    if (constants.ENVIRONMENT !== constants.ENVIRONMENT_NAMES.PROD) {
        log.info('not in prod, skipping commit');
        return Promise.resolve();
    }

    if (!config.forceReload && fileChanges.onlyManifestChanged) {
        log.info('Skipping commit; only manifest file changed');
        return Promise.resolve();
    }

    return Promise.all([
        _fetchBlobs(fileChanges.unchanged),
        _createNewBlobs(fileChanges.added.concat(fileChanges.modified))
    ]).then(results => [].concat(...results))
        .then(blobs => _createTree(blobs))
        .then(tree => _createCommit(tree))
        .then(commit => _updateBranch(commit))
        .then(result => {
            console.log('result', result);
        });


    function _fetchBlobs(files) {
        log.info('-------------- Fetching Current Tree --------------');
        // While we could theoretically calculate these ourselves, line breaks make it...tricky. So we'll rely on Github.
        return readTree(config.contentInfo.treeSha, '');

        function readTree(treeSha, basePath) {
            return ghClient.getTree(
                constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, treeSha
            ).then(tree => {
                let blobs = [];
                let parts = tree.tree;
                parts.filter(t => t.type === 'blob')
                    .map(t => {
                        return {path: path.join(basePath, t.path), blob: t.sha, mode: t.mode};
                    })
                    .filter(t => files.includes(t.path))
                    .forEach(t => blobs.push(t));
                return Promise.all(
                    parts.filter(t => t.type === 'tree')
                        .map(t => readTree(t.sha, path.join(basePath, t.path)))
                ).then(results => blobs.concat(...results));
            });
        }
    }

    function _createNewBlobs(files) {
        log.info('-------------- Creating New Blobs --------------');
        let promises = files.map(f => {
            let fullPath = path.join(contentPath, f);
            return ghClient.addBlob(
                constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, fullPath
            ).then(result => {
                return {path: f, blob: result.sha, mode: result.mode};
            })
        });

        return Promise.all(promises)
            .then(results => [].concat(...results));
    }

    function _createTree(blobs) {
        log.info('-------------- Creating New Tree --------------');
        let tree = blobs.map(b => {
            return {
                path: b.path,
                mode: b.mode,
                sha: b.blob,
                type: 'blob'
            };
        });

        return ghClient.createTree(
            constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, tree
        );
    }

    function _createCommit(treeSha) {
        log.info('-------------- Creating Commit --------------');
        let commit = {
            message: 'Update CDN Contents',
            tree: treeSha,
            parents: [config.contentInfo.commitSha]
        };
        return ghClient.createCommit(
            constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, commit
        );
    }

    function _updateBranch(commitSha) {
        return ghClient.updateRef(
            constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, 'heads/' + constants.CDN.CONTENT_BRANCH, commitSha
        );
    }

};



