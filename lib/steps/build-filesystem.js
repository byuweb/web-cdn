/**
 * Created by ThatJoeMoore on 1/25/17
 */
"use strict";

const fs = require('fs-extra-p');
const path = require('path');
const cpx = require('cpx');
const log = require('winston');
const klaw = require('klaw');
const constants = require('./../constants');
const ghClient = require('./../github/github-client');
const util = require('./../util');
const sources = require('./../sources/index');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * @typedef {{}} FilesystemChanges
 * @property {string[]} added
 * @property {string[]} deleted
 * @property {string[]} modified
 * @property {string[]} unchanged
 * @property {boolean} onlyManifestChanged
 * @property {object.<string, string>} hashes
 */

/**
 *
 * @param {CdnConfig} config
 * @param {string} contentPath
 * @param {string} workPath
 * @return {Promise.<FilesystemChanges>}
 */
module.exports = function buildFilesystem(config, contentPath, workPath) {
    let initialFileHashes;
    return _createScratch()
        .then(() => _downloadContent())
        .then(() => _hashFilesystem().then(hashes => initialFileHashes = hashes))
        .then(() => _deleteVersions())
        .then(() => _downloadWorkingFiles())
        .then(() => _clearDestinations())
        .then(() => _copyFiles())
        .then(() => _writeShaFiles())
        .then(() => _writeAliases())
        .then(() => _writeManifest())
        .then(() => _identifyFileChanges(initialFileHashes));

    function promiseNeedingUpdates(func) {
        return config.promiseAllLibVersions((lib, ver) => {
            if (!ver.needsUpdate) return Promise.resolve();
            return func(lib, ver);
        });
    }

    function _createScratch() {
        return fs.emptyDir(contentPath)
            .then(() => fs.emptyDir(workPath));
    }

    function _downloadContent() {
        log.info('-------------- Downloading Current CDN Contents --------------');
        return ghClient.downloadTarball(
            constants.CDN.GITHUB_ORG, constants.CDN.GITHUB_REPO, constants.CDN.CONTENT_BRANCH,
            contentPath
        );
    }

    function _hashFilesystem() {
        return _scanFiles(contentPath)
            .then(files => {
                let hashes = {};
                return Promise.all(
                    files.map(f => {
                        let relativePath = path.relative(contentPath, f.path);
                        let reader = f.type === 'FILE' ? fs.readFile(f.path) : fs.readlink(f.path);
                        return reader.then(contents => {
                            let hash = crypto.createHash('sha1');
                            hash.update(f.type);
                            hash.update(contents);
                            return hash.digest('hex');
                        }).then(hash => {
                            hashes[relativePath] = hash;
                        });
                    })
                ).then(() => hashes);
            });
    }

    function _scanFiles(dir, options) {
        return _promiseKlaw(dir, options).then(entries => {
            return entries.filter(i => i.stats.isFile() || i.stats.isSymbolicLink())
                .map(i => {
                    return {
                        path: i.path,
                        type: i.stats.isFile() ? 'FILE' : 'SYMLINK'
                    }
                });
        });
    }

    function _promiseKlaw(dir, options) {
        return new Promise((resolve, reject) => {
            let files = [];
            klaw(dir, options)
                .on('end', () => resolve(files))
                .on('error', reject)
                .on('data', item => files.push(item));
        });
    }

    function _deleteVersions() {
        return config.promiseAllLibVersions((lib, ver) => {
            if (ver.deleted) {
                return fs.remove(_contentDir(lib, ver));
            } else {
                return Promise.resolve();
            }
        });
    }

    function _downloadWorkingFiles() {
        log.info('-------------- Downloading Library Contents --------------');
        return promiseNeedingUpdates((lib, ver) => {
            log.info(`Downloading contents of ${lib.id}@${ver.ref}`);
            return sources.downloadTarball(lib.sourceInfo, ver.ref, _workDir(lib, ver));
        })
    }

    function _clearDestinations() {
        return promiseNeedingUpdates((lib, ver) =>
            // filesystem.emptyDir(path.join(lib.id, ver.name))
            fs.emptyDir(_contentDir(lib, ver))
        );
    }

    function _copyFiles() {
        log.info('-------------- Copying Library Files --------------');
        return promiseNeedingUpdates((lib, ver) => {
            let workDir = _workDir(lib, ver);
            let contentDir = _contentDir(lib, ver);
            let copyPromises = ver.resources.mappings.map(r => {
                let dest = r.dest ? path.join(contentDir, r.dest) : contentDir;
                log.info(`copying ${r.src} to ${dest}`);
                return new Promise((resolve, reject) => {
                    cpx.copy(path.join(workDir, r.src), dest, err => {
                        if (err) reject(err);
                        else resolve();
                    })
                });
            });
            return Promise.all(copyPromises);
        });
    }

    function _writeShaFiles() {
        log.info('-------------- Writing Library SHA Files --------------');
        return promiseNeedingUpdates((lib, ver) => {
            let contentDir = _contentDir(lib, ver);
            return fs.writeFile(path.join(contentDir, '.git-sha'), ver.commitSha);
        });
    }

    function _writeAliases() {
        log.info('-------------- Creating Library Symlinks --------------');
        return config.promiseAllLibs(lib => {
            let libPath = path.join(contentPath, lib.id);
            let promises = util.objectAsArray(lib.aliases)
                .map(pair => {
                    let {key, value} = pair;
                    let link = path.join(libPath, key);
                    let target = value + path.sep;
                    return fs.remove(link)
                        .catch(() => null) //swallow errors
                        .then(() => fs.ensureSymlink(target, link));
                });
            return Promise.all(promises);
        });
    }

    function _writeManifest() {
        log.info('-------------- Writing New Manifest --------------');

        let resourcesPromise = config.promiseAllLibVersions((lib, ver) => {
            let contentDir = _contentDir(lib, ver);
            try {
                let stats = fs.lstatSync(contentDir);
                if (!stats.isDirectory() && !stats.isSymbolicLink()) {
                    console.log(`${contentDir} isn't a directory or symlink, skipping`);
                    return;
                }
            } catch (err) {
                console.log(`unable to scan ${contentDir}, skipping`, err);
                return;
            }

            return _scanFiles(contentDir, {filter: f => path.basename(f) !== '.git-sha'})
                .then(files => {
                    return Promise.all(
                        files.map(f => _getFileSummary(f.path).catch(err => console.error(f.path, err))
                            .then(s => {
                                return {path: f.path, summary: s}
                            })
                        )
                    );
                }).then(files => {
                    return files.reduce((resources, each) => {
                        let relative = path.relative(contentDir, each.path);
                        let ep = ver.resources.entrypoints[relative];
                        resources[relative] = {
                            entrypoint: !!ep,
                            description: ep,
                            size: each.summary.size,
                            gzip_size: each.summary.gzip_size,
                            hashes: each.summary.hashes
                        };
                        return resources;
                    }, {});
                });
        });

        return resourcesPromise
            .then(resources => {
                /**
                 * @type {Manifest}
                 */
                let manifest = {
                    '$cdn-version': config.cdnVersion,
                    '$built': new Date().toISOString(),
                    libraries: config.libs.reduce((result, lib) => {
                            let l = result[lib.id] = {
                                name: lib.name,
                                description: lib.description,
                                docs_url: lib.docs,
                                source: lib.sourceInfo.full
                            };
                            l.aliases = lib.aliases;

                            l.versions = lib.versions.map(version => {
                                let v = {
                                    name: version.name,
                                    ref: version.ref,
                                    tarball_url: version.tarballUrl,
                                    git_sha: version.commitSha,
                                    link: version.link,
                                    last_updated: version.lastUpdate.format(),
                                    experimental: version.experimental
                                };
                                if (!v.canUpdate) {
                                    v.messages = version.messages;
                                }
                                v.resources = resources[lib.id][version.name];
                                return v;
                            });
                            result[lib.id] = l;
                            return result;
                        }, {}
                    )
                };

                return manifest;
            })
            .then(manifest => fs.writeJson(path.join(contentPath, 'manifest.json'), manifest))
    }

    /**
     *
     * @param {object.<string, string>} oldHashes
     * @returns {Promise.<FilesystemChanges>}
     * @private
     */
    function _identifyFileChanges(oldHashes) {
        return _hashFilesystem()
            .then(newHashes => {
                let oldNames = Object.getOwnPropertyNames(oldHashes);
                let newNames = Object.getOwnPropertyNames(newHashes);

                let added = newNames.filter(each => !oldNames.includes(each));
                let deleted = oldNames.filter(each => !newNames.includes(each));

                let modified = newNames
                    .filter(name => !added.includes(name))//Make sure we don't duplicated values that were added
                    .filter(name => {
                        return oldHashes[name] !== newHashes[name];
                    });

                let unchanged = newNames
                    .filter(f => !added.includes(f))
                    .filter(f => !modified.includes(f));

                let onlyManifestChanged = !added.length && !deleted.length && modified.length === 1 && modified[0] === 'manifest.json';

                return {
                    added: added,
                    modified: modified,
                    deleted: deleted,
                    unchanged: unchanged,
                    onlyManifestChanged: onlyManifestChanged,
                    hashes: newHashes
                };
            });
    }

    function _workDir(library, version) {
        return path.join(workPath, library.id, version.name);
    }

    function _contentDir(library, version) {
        if (version.experimental) {
            return path.join(contentPath, library.id, 'experimental', version.name);
        } else {
            return path.join(contentPath, library.id, version.name);
        }
    }

    function _getFileSummary(file) {
        let statPromise = fs.lstat(file);
        let contentPromise = fs.readFile(file);

        let gzipPromise = contentPromise.then(content => {
            return new Promise((resolve, reject) => {
                zlib.gzip(content, null, (err, zipped) => {
                    if (err) reject(err);
                    else resolve(zipped.length)
                })
            });
        });

        let hashPromise = contentPromise.then(content => {
            return {
                sha256: util.hash('sha256', content),
                sha384: util.hash('sha384', content),
                sha512: util.hash('sha512', content)
            }
        });

        return Promise.all([statPromise, gzipPromise, hashPromise])
            .then(results => {
                let [stat, gzip, hash] = results;
                return {
                    size: stat.size,
                    gzip_size: gzip,
                    hashes: hash
                }
            });
    }

};

