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

const S3Client = require('aws-sdk').S3;

const s3Client = new S3Client();

const os = require('os');

const PQueue = require('p-queue');

const copyQueue = new PQueue({concurrency: os.cpus().length * 4});

const runCommand = require('./util/run-command');
const path = require('path');

const log = require('winston');
const fs = require('fs-extra');
const cloudfront = require('./util/cloudfront');

const LARGE_FILE_PREFIX = '.cdn-infra/file-blobs/';

exports.uploadFiles = async function (buildContext, files, actions, manifest) {
    const {targetBucket: bucket, cdnHost, dryRun} = buildContext;

    log.debug(`Uploading ${files.length} files to ${bucket}`);

    const staging = path.join(buildContext.directories.workDir, 's3-staging');

    await stageContents(files, staging);

    log.info('Uploading file contents');
    await uploadContents(bucket, staging, dryRun);

    if (dryRun) {
        log.debug('Dry Run. Skipping.');
        return;
    }

    log.info('Copying file contents');
    await copyFilesToDestination(bucket, files);

    // log.info('Updating Manifest');
    // await uploadManifest(bucket, manifest, dryRun);

    log.info('Invalidate Infra files');
    await invalidateInfraFiles(files, cdnHost, dryRun);
};

async function stageContents(files, dir) {
    log.info('Staging file contents into', dir);
    await fs.emptyDir(dir);

    const copied = new Set();

    for (const file of files) {
        const stageName = stageNameFor(file);

        const dest = path.join(dir, stageName);

        if (copied.has(stageName)) {
            continue;
        }

        if (file.contentPath) {
            log.debug('Copying', file.contentPath, 'to', dest);
            await fs.copy(file.contentPath, dest);
        } else if (file.hasOwnProperty('contents')) {
            log.debug('Writing contents to', dest);
            await fs.writeFile(dest, file.contents);
        }
    }
}

async function uploadContents(bucket, dir, dryRun) {
    log.debug('Syncing file contents with S3');
    const args = [
        's3',
        'sync',
        dir,
        `s3://${bucket}/${LARGE_FILE_PREFIX}`,
        '--acl', 'private',
        '--size-only'
    ];

    if (dryRun) {
        args.push('--dryrun')
    }

    await runCommand('S3 Content Sync', 'aws', args);
}

function stageNameFor(file) {
    return path.basename(file.cdnPath).toLowerCase() + '__' + file.fileSha512;
}

function normalizeS3Key(key) {
    if (key.startsWith('/')) {
        return key.substr(1);
    }
    return key;
}

async function copyFilesToDestination(bucket, files) {
    return batch(copyQueue, files, async file => {
        const stageName = stageNameFor(file);

        const config = {
            Bucket: bucket,
            ACL: 'public-read',
            CacheControl: file.meta.cacheControl,
            ContentType: file.type,
            CopySource: `/${bucket}/${LARGE_FILE_PREFIX}${stageName}`,
            Key: normalizeS3Key(file.cdnPath),
            Metadata: metadataForFile(file),
            MetadataDirective: "REPLACE",
        };

        if (file.meta.redirect) {
            if (file.meta.redirect.status) {
                config.Metadata['*status*'] = String(file.meta.redirect.status);
            }
            config.WebsiteRedirectLocation = file.meta.redirect.location;
        }

        log.debug(`Copying to ${config.Key} from ${stageName}`);
        try {
            await s3Client.copyObject(config).promise();
        } catch (e) {
            console.error('error copying', config.CopySource, 'to', config.Key);
            throw e;
        }

        if (file.meta.tags) {
            log.debug(`Tagging ${config.Key}`);
            try {
                await s3Client.putObjectTagging({
                    Bucket: bucket,
                    Key: config.Key,
                    Tagging: {
                        TagSet: Object.entries(file.meta.tags)
                            .map(([key, value]) => {
                                return {
                                    Key: key,
                                    Value: value
                                }
                            }),
                    }
                }).promise();
            } catch (err) {
                console.error('error tagging', config.Key);
                throw err;
            }
        }

        log.debug(`Finished Copying ${config.Key}`);
    });
}

async function invalidateInfraFiles(files, cdnHost, dryRun) {
    const paths = files.filter(it => it.invalidate)
        .map(it => it.cdnPath);

    paths.push('/manifest.json');
    if (dryRun) {
        log.debug('Dry run; would have invalidated', paths);
        return;
    }
    const distro = await cloudfront.getDistributionForAlias(cdnHost);
    if (!distro) {
        log.warn(`!!!!!!!!! Unable to create CloudFront Invalidation: couldn't find distribution with alias ${cdnHost}`);
        return;
    }

    const id = distro.Id;

    await cloudfront.invalidate(id, paths);
}

function metadataForFile(file) {
    if (!file.meta || !file.meta.headers) {
        return {};
    }
    return Object.entries(file.meta.headers)
        .reduce((obj, [key, value]) => {
            obj['*header*' + key] = value;
            return obj;
        }, {});
}

async function batch(queue, items, action) {
    return queue.addAll(items.map(queuedAction));

    function queuedAction(item) {
        return () => action(item);
    }
}
