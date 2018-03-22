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

const s3Opts = {
    maxAsyncS3: 5,
    s3Client: s3Client,
};

const os = require('os');

const UPLOAD_PARALLELISM = os.cpus().length;

const s3 = require('s3').createClient(s3Opts);
const runCommand = require('./util/run-command');
const sets = require('./util/sets');
const path = require('path');

const log = require('winston');
const fs = require('fs-extra');
const mime = require('mime');

const LARGE_FILE_LIMIT = 512000; //512 kB

const LARGE_FILE_PREFIX = '.cdn-meta/large-blobs/';

module.exports = async function uploadFiles(oldManifest, newManifest, versionManifests, actions, bucket, assembledDir, cdnHost, dryRun) {
    let sync = [];
    let invalidate = ['manifest.json'];
    let remove = [];
    let syncLargeFile = [];

    Object.entries(actions).forEach(([libId, libActions]) => {
        let libDefn = newManifest.libraries[libId] || oldManifest.libraries[libId];
        let libManifests = versionManifests[libId];

        let syncActions = prepareLibSync(libId, libDefn, libManifests, libActions, assembledDir);

        sync.push(...syncActions.sync);
        syncLargeFile.push(...syncActions.syncLargeFile);
        invalidate.push(...syncActions.invalidate);
        remove.push(...syncActions.remove);
    });

    log.info('Uploading large files');
    const largeFileFollowUp = await uploadLargeFiles(bucket, assembledDir, syncLargeFile, dryRun);

    log.info('Starting Sync jobs:\n\t' + sync.map(each => each.to).join('\n\t'));

    await batch(sync, UPLOAD_PARALLELISM, each => {
        return syncDir(bucket, each.from, each.to, each.metadata, each.cacheControl, dryRun)
    });

    log.info('Finishing large file uploads');
    await copyLargeFiles(largeFileFollowUp, dryRun);

    log.info('Starting Remove jobs:\n\t' + remove.join('\n\t'));
    await batch(remove, UPLOAD_PARALLELISM, each => {
        return deleteDir(bucket, each, dryRun);
    });

    // log.info('Updating alias RedirectRules');
    // let redirects = computeRedirects(newManifest);
    // await updateRedirects(bucket, redirects, cdnHost, dryRun);

    log.info('Updating Manifest');
    await uploadManifest(bucket, newManifest, dryRun);

    log.info('Updating Metadata Files');
    await uploadMetadataFiles(bucket, newManifest, cdnHost, dryRun);

    //TODO: add cloudfront invalidation
};

async function batch(items, parallelism, action) {
    for (let chunk of chunkArray(items, parallelism)) {
        await Promise.all(
            chunk.map(action)
        );
    }
}

function chunkArray(array, chunkSize) {
    let result = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        let chunk = array.slice(i, i + chunkSize);
        result.push(chunk);
    }

    return result;
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

        syncActions.sync.push({
            from: assembled,
            to: prefix,
            metadata,
            cacheControl
        });

        syncActions.invalidate.push(prefix + '*');

        let aliases = aliasesReversed[versionName];

        if (aliases) {
            aliases.forEach(alias => {
                let aliasPrefix = `${libId}/${alias}/`;
                syncActions.invalidate.push(aliasPrefix + "*")
            });
        }

        Object.entries(manifest.resources)
            .filter(([key, it]) => it.size >= LARGE_FILE_LIMIT)
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

async function uploadLargeFiles(bucket, assembledDir, files, dryRun) {
    log.info('Uploading large files');

    const dir = path.join(assembledDir, '__large-blobs');
    await fs.emptyDir(dir);

    const copied = new Set();
    for (const file of files) {
        const sha = file.fileSha512;
        if (copied.has(sha)) {
            continue;
        }

        await fs.copy(file.from, path.join(dir, sha));

        copied.add(sha);
    }

    const args = [
        's3', 'sync',
        dir, 's3://' + bucket + '/' + LARGE_FILE_PREFIX,
        '--acl', 'private',
        '--storage-class', 'REDUCED_REDUNDANCY'
    ];
    if (dryRun) {
        args.push('--dryrun');
    }

    await runCommand('aws s3 sync large files', 'aws', args);

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
        uploader.on('progress', function () {
            log.debug(`${prefix} progress`, uploader.progressAmount, uploader.progressTotal);
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
    let routingRules = redirects.map(it => {
        return {
            Condition: {
                KeyPrefixEquals: it.from
            },
            Redirect: {
                Protocol: 'https',
                HostName: cdnHost,
                ReplaceKeyPrefixWith: it.to,
                HttpRedirectCode: "302"
            },
        };
    });

    if (dryRun) {
        log.info('skipping (dry run). Would set up routing rules:\n' + JSON.stringify(routingRules, null, 2));
        return;
    }
    log.info('Configuring Routing Rules:\n' + JSON.stringify(routingRules, null, 2));
    let config = await s3Client.getBucketWebsite({Bucket: bucket}).promise();

    config.RoutingRules = routingRules;

    return s3Client.putBucketWebsite({
        Bucket: bucket,
        WebsiteConfiguration: config
    }).promise();
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
