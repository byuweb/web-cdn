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

const S3Client = require('aws-sdk').S3;

const s3Client = new S3Client();

const s3Opts = {
    maxAsyncS3: 5,
    s3Client: s3Client,
};

const os = require('os');

const PQueue = require('p-queue');

const uploadQueue = new PQueue({concurrency: os.cpus().length});
const copyQueue = new PQueue({concurrency: os.cpus().length * 4});

const s3 = require('s3').createClient(s3Opts);
const runCommand = require('../util/run-command');
const sets = require('../util/sets');
const path = require('path');

const log = require('winston');
const fs = require('fs-extra');
const mime = require('mime');
const cloudfront = require('../util/cloudfront');

const LARGE_FILE_LIMIT = 768000; //768 kB

const LARGE_FILE_PREFIX = '.cdn-infra/file-blobs/';

module.exports.uploadFile1 = async function uploadFiles(oldManifest, newManifest, versionManifests, actions, bucket, assembledDir, cdnHost, dryRun) {
    let sync = [];
    let invalidate = ['manifest.json'];
    let remove = [];
    let syncLargeFile = [];
    let syncAlias = [];

    Object.entries(actions).forEach(([libId, libActions]) => {
        let libDefn = newManifest.libraries[libId] || oldManifest.libraries[libId];
        let libManifests = versionManifests[libId];

        let syncActions = prepareLibSync(libId, libDefn, libManifests, libActions, assembledDir);

        sync.push(...syncActions.sync);
        syncLargeFile.push(...syncActions.syncLargeFile);
        invalidate.push(...syncActions.invalidate);
        remove.push(...syncActions.remove);
        syncAlias.push(...syncActions.syncAlias)
    });

    log.info('Uploading large files');
    const largeFileFollowUp = await uploadLargeFiles(bucket, assembledDir, syncLargeFile, dryRun);

    log.info('Starting Sync jobs:\n\t' + sync.map(each => each.to).join('\n\t'));

    await batch(uploadQueue, sync, each => {
        return syncDir(bucket, each.from, each.to, each.metadata, each.cacheControl, dryRun)
    });

    log.info('Finishing large file uploads');
    await copyLargeFiles(largeFileFollowUp, dryRun);

    log.info('Starting Remove jobs:\n\t' + remove.join('\n\t'));
    await batch(uploadQueue, remove, each => {
        return deleteDir(bucket, each, dryRun);
    });

    // log.info('Updating aliases');
    // let redirects = computeRedirects(newManifest);
    // await updateRedirects(bucket, redirects, cdnHost, dryRun);

    log.info('Updating Manifest');
    await uploadManifest(bucket, newManifest, dryRun);

    log.info('Updating Metadata Files');
    await uploadMetadataFiles(bucket, newManifest, cdnHost, dryRun);

    //TODO: add cloudfront invalidation
};

exports.uploadFiles2 = async function (buildContext, files, actions, manifest) {
    const {targetBucket: bucket, cdnHost, dryRun} = buildContext;

    log.debug(`Uploading ${files.length} files to ${bucket}`);

    if (dryRun) {
        log.debug('Dry Run. Skipping.');
        return;
    }

    log.info('Uploading file contents');
    await uploadContents(bucket, files);

    log.info('Copying file contents');

    await copyFilesToDestination(bucket, files);

    log.info('Updating Manifest');
    await uploadManifest(bucket, manifest, dryRun);

    log.info('Invalidate Infra files');
    await invalidateInfraFiles(files, cdnHost, dryRun);
};

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

async function uploadContents(bucket, files) {
    const copied = new Set();

    return batch(uploadQueue, files, async file => {
        const sha = file.fileSha512;

        if (copied.has(sha)) {
            return;
        }

        const s3Key = LARGE_FILE_PREFIX + sha;

        if (!await existsInS3(bucket, s3Key)) {
            await uploadFileContents(bucket, s3Key, file);
        }
        copied.add(sha);
    });
}

async function uploadFileContents(bucket, s3Key, file) {
    let body;
    if (file.contentPath) {
        body = fs.createReadStream(file.contentPath);
    } else if (file.contents) {
        body = file.contents;
    } else {
        body = '';
    }

    await s3Client.putObject({
        Bucket: bucket,
        Key: s3Key,
        ACL: 'private',
        Body: body,
        ContentType: file.type
    }).promise();
}

function normalizeS3Key(key) {
    if (key.startsWith('/')) {
        return key.substr(1);
    }
    return key;
}

async function copyFilesToDestination(bucket, files) {
    return batch(copyQueue, files, async file => {
        const sha = file.fileSha512;
        if (!sha) {
            return;
        }
        const config = {
            Bucket: bucket,
            ACL: 'public-read',
            CacheControl: file.meta.cacheControl,
            ContentType: file.type,
            CopySource: `/${bucket}/${LARGE_FILE_PREFIX}${sha}`,
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

        log.debug(`Copying ${sha} to ${config.Key}`);
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

function prefixFor(libId, version) {
    return `${libId}/${versionPath(version)}/`;
}

function versionPath(version) {
    return version.type === 'branch' ? `experimental/${version.name}` : version.name;
}

function prepareLibSync(libId, lib, versionManifests, actions, assembledDir) {
    let syncActions = {
        sync: [],
        syncLargeFile: [],
        invalidate: [],
        remove: [],
        syncAlias: [],
    };
    if (actions.deleteLib) {
        syncActions.remove.push(libId + '/');
        return syncActions;
    }

    let versionsToUpload = sets.union(actions.add, actions.update);

    let aliasesReversed = invertMap(lib.aliases);

    versionsToUpload.forEach(versionName => {
        let version = lib.versions.find(it => it.name === versionName);
        let manifest = versionManifests[versionName];

        let assembled = path.join(assembledDir, libId, versionName);

        let prefix = prefixFor(libId, version);

        const metadata = metadataFor(libId, version);
        const cacheControl = cacheControlFor(libId, version);
        const aliasCacheControl = aliasCacheControlFor(libId, version);

        syncActions.sync.push({
            from: assembled,
            to: prefix,
            metadata,
            cacheControl
        });

        syncActions.invalidate.push(prefix + '*');

        let aliases = aliasesReversed[versionName];

        const resources = Object.entries(manifest.resources);

        if (aliases) {
            aliases.forEach(alias => {
                let aliasPrefix = `${libId}/${alias}/`;
                syncActions.invalidate.push(aliasPrefix + "*");

                resources.forEach(([key, it]) => {
                    syncActions.syncAlias.push({
                        path: aliasPrefix + key,
                        target: prefix + key,
                        cacheControl: aliasCacheControl
                    })
                });
            });
        }

        resources.filter(([key, it]) => it.size >= LARGE_FILE_LIMIT)
            .map(([key, it]) => {
                return {
                    from: path.join(assembled, key),
                    to: prefix + key,
                    fileSha512: it.hashes.sha512.hex,
                    metadata,
                    cacheControl
                };
            })
            .forEach(res => {
                syncActions.syncLargeFile.push(res)
            });
    });

    for (let version of actions.remove) {
        let prefix = lib.type === 'branch' ? `${libId}/experimental/${version}` : `${libId}/${version}`;

        syncActions.remove.push(prefix);
    }

    return syncActions;
}

async function existsInS3(bucket, key) {
    try {
        await s3Client.headObject({
            Bucket: bucket,
            Key: key
        }).promise();
        return true;
    } catch (err) {
        return false;
    }
}

async function uploadLargeFiles(bucket, assembledDir, files, dryRun) {
    log.info('Uploading large files');

    const copied = new Set();
    for (const file of files) {
        log.debug('Copying', file.from);
        const sha = file.fileSha512;
        if (copied.has(sha)) {
            log.debug('Already copied ' + file.from);
            continue;
        }

        const s3Key = LARGE_FILE_PREFIX + sha;
        if (await existsInS3(bucket, s3Key)) {
            log.debug(`${sha.substr(0, 10)}... already exists`);
            copied.add(sha);
        } else if (dryRun) {
            log.info(`Would upload large file ${sha.substr(0, 10)}... from ${file.from}`);
        } else {
            log.info(`Uploading large file ${sha.substr(0, 10)}... from ${file.from}`);
            await uploadLargeFile(bucket, file.from, s3Key);
        }

        copied.add(sha);
    }

    log.info('Deleting large files from assembled directories');

    for (const file of files) {
        log.debug('Deleting large file', file.from);
        await fs.remove(file.from);
    }

    return files.map(file => {
        return {
            Bucket: bucket,
            ACL: "public-read",
            CacheControl: file.cacheControl,
            ContentType: mime.getType(file.to),
            CopySource: '/' + bucket + '/' + LARGE_FILE_PREFIX + file.fileSha512,
            Key: file.to,
            Metadata: file.metadata,
        };
    });
}

async function copyLargeFiles(copyParams, dryRun) {
    if (dryRun) {
        log.info('skipping large file copy (dry run)');
        return;
    }
    await Promise.all(
        copyParams.map(params =>
            s3Client.copyObject(params).promise()
                .then(() => log.debug('Finished copying large file', params.Key))
                .catch(err => {
                    log.error('Error copying', params.CopySource, 'to', params.Key);
                    throw err;
                })
        )
    );
    log.info('Done copying large files');
}

async function uploadManifest(bucket, manifest, dryRun) {
    log.info('Uploading manifest');
    if (dryRun) {
        log.info('skipping (dry run)');
        return;
    }
    await s3Client.putObject({
        Body: JSON.stringify(manifest, null, 2),
        Bucket: bucket,
        Key: 'manifest.json',
        ACL: 'public-read',
        ContentType: 'application/json',
        CacheControl: 'public, must-revalidate, proxy-revalidate, max-age=300, s-maxage=60'
    }).promise();
    log.info('Finished uploading manifest');
}

async function uploadMetadataFiles(bucket, manifest, cdnHost, dryRun) {
    log.info("Uploading CDN meta files");
    let aliases = extractAliases(manifest, cdnHost);
    if (dryRun) {
        log.info('skipping (dry run).');
        log.debug('Would have written:\n.cdn-meta/aliases.json', JSON.stringify(aliases));
        log.debug('Would have written:\n.cdn-meta/hostname', cdnHost);
        return;
    }
    await s3Client.putObject({
        Body: JSON.stringify(aliases),
        Bucket: bucket,
        Key: '.cdn-meta/aliases.json',
        ACL: 'public-read',
        ContentType: 'application/json',
        CacheControl: 'public, must-revalidate, proxy-revalidate, max-age=300, s-maxage=60'
    }).promise();
    await s3Client.putObject({
        Body: cdnHost,
        Bucket: bucket,
        Key: '.cdn-meta/hostname',
        ACL: 'public-read',
        ContentType: 'text/plain',
        CacheControl: 'public, max-age=31557600, s-maxage=31557600, immutable'
    }).promise();
    log.info('Finished uploading metadata');
}

async function uploadLargeFile(bucket, localFile, s3Key) {
    await runCommand('S3 Upload File', 'aws', [
        's3',
        'cp',
        localFile,
        `s3://${bucket}/${s3Key}`,
        '--content-type', mime.getType(path.parse(localFile).ext),
        '--acl', 'private',
    ]);
}

function extractAliases(manifest) {
    return Object.entries(manifest.libraries).reduce((result, [libId, lib]) => {
        result[libId] = Object.entries(lib.aliases).reduce((acc, [alias, versionName]) => {

            let version = lib.versions.find(it => it.name === versionName);

            acc[alias] = versionPath(version);

            return acc;
        }, {});

        return result;
    }, {});
}

async function syncDir(bucket, local, prefix, metadata, cacheControl, dryRun) {
    log.info(`Syncing ${local} to ${prefix}`);
    if (dryRun) {
        log.info('skipping (dry run)');
        return;
    }

    return new Promise((resolve, reject) => {
        const params = {
            localDir: local,
            deleteRemoved: true,
            s3Params: {
                Bucket: bucket,
                Prefix: prefix,
                Metadata: metadata,
                CacheControl: cacheControl,
                ACL: 'public-read',
            },
        };
        const uploader = s3.uploadDir(params);
        uploader.on('error', function (err) {
            log.error("unable to sync:", err.stack);
            reject(err);
        });
        uploader.on('fileUploadEnd', function (localPath, s3Key) {
            log.debug(`Finished uploading ${s3Key}`);
        });
        uploader.on('end', function () {
            log.info(`Finished syncing ${prefix}`);
            resolve();
        });
    });
}

async function deleteDir(bucket, prefix, dryRun) {
    log.info(`Deleting ${prefix}`);
    if (dryRun) {
        log.info('skipping (dry run)');
        return;
    }
    return new Promise((resolve, reject) => {
        let del = s3.deleteDir({
            Bucket: bucket,
            Prefix: prefix,
        });
        del.on('error', reject);
        del.on('end', resolve);
    });
}

async function updateRedirects(bucket, redirects, cdnHost, dryRun) {
    // let routingRules = redirects.map(it => {
    //     return {
    //         Condition: {
    //             KeyPrefixEquals: it.from
    //         },
    //         Redirect: {
    //             Protocol: 'https',
    //             HostName: cdnHost,
    //             ReplaceKeyPrefixWith: it.to,
    //             HttpRedirectCode: "302"
    //         },
    //     };
    // });

    if (dryRun) {
        log.info('skipping (dry run)');
        return;
    }

    log.info('Configuring Alias Redirects:\n' + JSON.stringify(routingRules, null, 2));

}

function metadataFor(libId, version) {
    return {
        'X-BYU-CDN-Version': version.ref,
        'X-BYU-CDN-Version-Type': version.type,
        'X-BYU-CDN-Version-Sha': version.source_sha,
    }
}

function cacheControlFor(libId, version) {
    if (version.type === 'release') {
        return 'public, max-age=31557600, s-maxage=31557600, immutable';
    } else {
        return 'public, max-age=300, s-maxage=300';
    }
}

function aliasCacheControlFor(libId, version) {
    if (version.type === 'release') {
        return 'public, max-age=3600, s-maxage=300';
    } else {
        return 'public, max-age=60, s-maxage=0';
    }
}

function computeRedirects(manifest) {
    return Object.entries(manifest.libraries).reduce((redirects, [libId, lib]) => {
        let aliasByVersion = invertMap(lib.aliases);
        let libRedirects = lib.versions.filter(it => !!aliasByVersion[it.name])
            .map(version => {
                let versionPrefix = prefixFor(libId, version);
                let versionAliases = aliasByVersion[version.name];
                return versionAliases.map(alias => {
                    return {
                        from: `${libId}/${alias}/`,
                        to: versionPrefix,
                    }
                });
            }).reduce((array, each) => {
                return array.concat(each);
            }, []);
        return libRedirects.concat(redirects);
    }, []);
}

function invertMap(object) {
    return Object.entries(object).reduce((inverted, [alias, target]) => {
        let array = inverted[target];
        if (!array) {
            array = inverted[target] = [];
        }
        array.push(alias);
        return inverted;
    }, {});
}
