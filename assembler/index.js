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

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fs = require('fs-extra');
const path = require('path');
const log = require('winston');
const axios = require('axios');

const loadGithubCredentials = require('./src/util/load-github-credentials');
const GithubProvider = require('./src/providers/github-provider');

const assembleManifest = require('./src/assemble-manifest');
const planActions = require('./src/plan-actions');
const downloadSources = require('./src/download-sources');
const assembleArtifacts = require('./src/copy-resources');
const buildMeta = require('./src/build-meta');
const {uploadFiles2} = require('./src/upload-files');
const buildLayout = require('./src/build-layout');
const constants = require('./src/constants');
const {NoopMessager, SlackMessager} = require('./src/messagers');

module.exports = async function cdnAssembler(config, targetBucket, opts) {
    let {workDir, githubCredentials, env} = (opts || {});

    await setupGithubCredentials(githubCredentials, env);

    log.info("Running assembly process");
    if (opts.dryRun) {
        log.warn("This is a dry run!")
    }

    log.info(`Using ${workDir} as scratch directory`);

    // await fs.emptyDir(workDir);
    await fs.ensureDir(workDir);

    let sourceDir = path.join(workDir, 'sources');
    let assembledDir = path.join(workDir, 'assembled');

    const messages = initMessager(opts);

    const buildContext = {
        config,
        targetBucket,
        dryRun: opts.dryRun,
        forceBuild: opts.forceBuild,
        directories: {
            workDir,
            sourceDir,
            assembledDir,
        },
        cdnHost: opts.cdnHost,
        env: opts.env,
        messages,
        started: new Date(),
    };

    try {
        log.info("----- Getting current manifest -----");
        let oldManifest = await getOldManifest(buildContext);

        log.info("----- Building new manifest -----");
        let newManifest = await assembleManifest(buildContext, oldManifest);

        await fs.writeJson(path.join(workDir, 'manifest.json'), newManifest, {
            spaces: 1,
            replacer: (key, value) => {
                if (key === 'config') {
                    return undefined;
                }
                return value;
            }
        });

        log.info("----- Planning Actions -----");
        let actions = planActions(buildContext, oldManifest, newManifest);

        if (actions.$forceUpdate) {
            buildContext.forceBuild = true;
        }

        if (!hasPlannedActions(actions)) {
            log.info("No planned actions. Exiting.");
            await messages.sendSuccess(buildContext);
            return;
        }

        logPlannedActions(buildContext, actions, oldManifest, newManifest);

        log.info("----- Downloading Sources -----");
        let sourceDirs = await downloadSources(buildContext, newManifest, actions);

        log.info("----- Assembling Artifacts -----");
        await assembleArtifacts(buildContext, newManifest, actions, sourceDirs);

        log.info("----- Building CDN Layout -----");
        const filesystem = await buildLayout(buildContext, oldManifest, newManifest, actions, sourceDirs);

        await fs.writeJson('./filesystem.json', filesystem, {spaces: 2});

        // log.info("----- Building Library Meta Files -----");
        // const versionManifests = await buildMeta(newManifest, assembledDir);
        //
        log.info("----- Uploading Files -----");
        await uploadFiles2(buildContext, filesystem, actions, newManifest);
        // await uploadFiles(oldManifest, newManifest, versionManifests, actions, targetBucket, assembledDir, cdnHost, dryRun);

        await messages.sendSuccess(buildContext);
    } catch (err) {
        await messages.sendError(buildContext, err);
        process.exit(1);
    }
};

async function getOldManifest({messages, targetBucket, cdnHost}) {
    const found = (await getManifestFromS3(targetBucket)) || (await getManifestViaHTTP(cdnHost));

    if (found) {
        return found;
    }
    messages.warning({message: `Unable to find an old version of the manifest. Using an empty one.`});
    return found || getEmptyManifest();
}

async function getManifestFromS3(bucket) {
    log.debug('Getting manifest from S3 bucket', bucket);
    try {
        let obj = await s3.getObject({
            Bucket: bucket,
            Key: 'manifest.json'
        }).promise();
        log.debug('Successfully got manifest from S3');
        return JSON.parse(obj.Body);
    } catch (err) {
        console.error('Error getting manifest from S3', err);
        return null;
    }
}

async function getManifestViaHTTP(cdnHost) {
    log.debug('Getting manifest from CDN via HTTP');
    try {
        const resp = await axios.get(`https://${cdnHost}/manifest.json`);
        log.debug('Got manifest via HTTP');
        return resp.data;
    } catch (err) {
        log.error('Error getting manifest via HTTP: ', err.response.status, err.message);
        return null;
    }
}

function getEmptyManifest() {
    return {
        '$cdn-version': constants.CDN.VERSION,
        '$manifest-spec': constants.CDN.MANIFEST_SPEC,
        '$built': '1970-01-01T00:00:00Z',
        libraries: {}
    };
}

function logPlannedActions(buildContext, actions, oldManifest, newManifest) {
    const {messages} = buildContext;
    log.info("----- Planned Actions: -----");

    Object.entries(actions).forEach(([id, acts]) => {
        const oldLib = oldManifest.libraries[id];
        const newLib = newManifest.libraries[id];
        log.info(` * ${id}`);
        if (acts.deleteLib) {
            log.info('   ## DELETE LIBRARY ##');
            messages.deletedLib({
                libId: id,
                libName: oldLib.name,
                libLink: oldLib.links.source,
            });
            return;
        }
        if (acts.add.length === 0 && acts.update.length === 0 && acts.remove.length === 0) {
            log.info('   No Changes');
            return;
        }

        const libInfo = {
            libId: id,
            libName: newLib.name,
            libLink: newLib.links.source,
        };

        if (!oldLib && newLib) {
            messages.addedLib(libInfo);
        } else {
            messages.updatedLib(libInfo);
        }

        if (acts.add.length > 0) {
            log.info('   Add ' + acts.add)
        }
        if (acts.update.length > 0) {
            log.info('   Update ' + acts.update)
        }
        if (acts.remove.length > 0) {
            log.info('   Remove ' + acts.remove)
        }

        for (const ver of newLib.versions) {
            const verInfo = {
                libId: id,
                versionId: ver.name,
                versionLink: ver.link,
            };
            if (acts.add.includes(ver.name)) {
                messages.newVersion(verInfo);
            } else if (acts.update.includes(ver.name)) {
                messages.updatedVersion(verInfo);
            }
        }
        if (oldLib) {
            for (const ver of oldLib.versions) {
                const verInfo = {
                    libId: id,
                    versionId: ver.name,
                    versionLink: ver.link,
                };
                if (acts.remove.includes(ver.name)) {
                    messages.removedVersion(verInfo);
                }
            }
        }

        const changedAliases = oldLib ? findChangedAliases(oldLib.aliases, newLib.aliases) : Object.entries(newLib.aliases);

        changedAliases.forEach(([alias, target]) => {
            messages.updatedAlias({libId: id, aliasName: alias, aliasTarget: target});
        });
    });
}

function findChangedAliases(oldAliases, newAliases) {
    return Object.entries(newAliases)
        .filter(([alias, target]) => {
            const old = oldAliases[alias];
            return old !== target;
        });
}

function hasPlannedActions(actions) {
    return Object.values(actions).some(acts => {
        return acts.removeLib || acts.add.length > 0 || acts.update.length > 0 || acts.remove.length > 0;
    });
}

async function setupGithubCredentials(credentials, env) {
    let actual;

    if (credentials) {
        actual = credentials;
    } else {
        actual = await loadGithubCredentials(env);
    }

    await GithubProvider.setCredentials(actual.user, actual.token);
}

function initMessager({slackUrl, slackChannel}) {
    if (slackUrl) {
        console.log('Initializing Slack Messager. Callback URL', slackUrl, 'channel', slackChannel);
        return new SlackMessager({webhookUrl: slackUrl, channel: slackChannel});
    } else {
        console.log('Initializing Console Messager');
        return new NoopMessager();
    }
}
