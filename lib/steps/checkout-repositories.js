/**
 * Created by ThatJoeMoore on 3/28/17.
 */
"use strict";

const sources = require('../sources');
const path = require('path');
const log = require('winston');

/**
 * @typedef {Object.<string, Object<string, {workDir: string}>>} WorkingDirs
 */

/**
 *
 * @param {CdnConfig} config
 * @param {string} workPath
 * @return {Promise.<WorkingDirs>}
 */
module.exports = function(config, workPath) {
    return downloadAllNeedingUpdates();

    function downloadAllNeedingUpdates() {
        log.info('-------------- Downloading Library Contents --------------');
        let result = {};
        return config.promiseVersionsNeedingUpdate((lib, ver) => {
            log.info(`Downloading contents of ${lib.id}@${ver.ref}`);
            let libResult = result[lib.id] = result[lib.id] || {};
            libResult[ver.name] = {
                workDir: workDir(lib, ver)
            };
            return sources.downloadTarball(lib.sourceInfo, ver, workDir(lib, ver));
        }).then(() => result);
    }

    function workDir(library, version) {
        return path.join(workPath, library.id, version.name);
    }

};
