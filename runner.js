"use strict";

const CdnConfig = require('./lib/cdn-config');
const path = require('path');
const checkoutRepos = require('./lib/steps/checkout-repositories');
const buildFilesystem = require('./lib/steps/build-filesystem');
const commitContent = require('./lib/steps/commit-content');
const pushToS3 = require('./lib/steps/push-to-s3');
const os = require('os');

/**
 * @typedef {{}} runnerConfig
 * @property {?string} tmpdir
 * @property {boolean} [dryRun]
 */

/**
 *
 * @param libraries
 * @param runnerConfig
 * @returns {Promise.<TResult>}
 */
module.exports = function runner(libraries, runnerConfig) {
    runnerConfig = runnerConfig || {};
    let tmpdir = runnerConfig.tmpdir || path.join(os.tmpdir(), 'cdn-build-scratch');

    const contentPath = path.join(tmpdir, 'content');
    const workPath = path.join(tmpdir, 'work');
    const stagingPath = path.join(tmpdir, 's3-staging');

    let dryRun = runnerConfig.dryRun;

    //Step 1 - Build the config
    return CdnConfig.loadFromConfig(libraries).then(cfg => {
        if (dryRun) {
            cfg.dryRun = true;
        }
        return checkoutRepos(cfg, workPath)
            .then(workPaths => {
                // Step 2 - Build the filesystem
                return buildFilesystem(cfg, contentPath, workPath).then(changes =>
                    // Step 3 - Commit content to Github
                    commitContent(cfg, changes, contentPath).then(() =>
                        // Step 4 - Push changes to S3
                        pushToS3(cfg, contentPath, stagingPath, changes)
                    )
                );

            });
    });
};
