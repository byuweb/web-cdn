"use strict";

const log = require('winston');
const fsp = require('fs-extra-p');
const decompress = require('decompress');
const path = require('path');
const os = require('os');
const http = require('../http/client')().async;
const util = require('../util');

const tmpdir = path.join(os.tmpdir(), 'tarball-downloads');
fsp.emptyDirSync(tmpdir);

module.exports = function downloadTarball(url, dest, opts) {
    let {httpClient = http} = (opts || {});
    let tarName = util.hash('sha256', url).hex;

    log.debug(`downloading tarball from ${url} to ${dest}`);
    return fsp.emptyDir(dest)
        .then(() => {
            let tar = path.join(tmpdir, `${tarName}.tgz`);
            log.debug('Downloading to temp file', tar);

            let stream = fsp.createWriteStream(tar);

            return new Promise((resolve, reject) => {
                httpClient(url)
                    .on('error', reject)
                    .pipe(stream);
                stream.on('finish', () => {
                    log.debug('Finished downloading');
                    resolve(tar);
                });
            });
        }).then(tar => {
            return decompress(tar, dest, {
                map: file => {
                    let p = file.path;
                    file.path = p.substr(p.indexOf(path.sep));
                    return file;
                }
            });
        }).then(() => {
            log.debug('finished decompressing to', dest);
            return dest;
        });
};

