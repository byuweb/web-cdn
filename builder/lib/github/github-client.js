/**
 * Created by ThatJoeMoore on 1/25/17.
 */
"use strict";

const constants = require('./../constants');
const ghAuth = require('./github-auth');
const httpClient = require('../http/client');
const getTarball = require('../http/get-tarball');
const decompress = require('decompress');
const os = require('os');

const http = ghAuth().then(auth => {
    return httpClient({authorization: auth})
});

const reqp = function() {
    let args = arguments;
    return http.then(clients => clients.promise.apply(this, args));
};

const req = http.then(clients => clients.async);

const path = require('path');
const fsp = require('fs-extra-p');
const log = require('winston');

const tmpdir = path.join(os.tmpdir(), 'github-tarballs');
fsp.emptyDirSync(tmpdir);

log.level = 'debug';

module.exports = {
    addBlob: addBlob,
    getLatestCommit: getLatestCommit,
    getFileContents: getFileContents,
    downloadTarball: downloadTarball,
    getTree: getTree,
    createCommit: createCommit,
    createTree: createTree,
    updateRef: updateRef
};

/**
 *
 * @param owner
 * @param repo
 * @param head
 * @returns {Promise.<{sha: string, url: string, author: object, committer: object, tree: {url: string, sha: string}}>}
 */
function getLatestCommit(owner, repo, head) {
    return reqp(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${head}`)
        .then(commit => {
            return reqp(commit.object.url);
        });
}

function getFileContents(owner, repo, ref, path) {
    log.debug(`getting contents from Github for ${owner} ${repo} ${path} @${ref}`);
    return reqp(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`)
        .then(result => {
            log.debug('Got file contents', result.headers);
            return new Buffer(result.content, result.encoding).toString('utf8');
        });
}

/**
 * @typedef {{path: string, type: string, [contents]: string}} fileInfo
 */
/**
 * @typedef {{path: string, type: string, [contents]: string, blob: ?string}} fileWithBlob
 */

const MODE_SYMLINK = '120000';
const MODE_FILE = '100644';

function addBlob(owner, repo, file) {
    console.log(`uploading blob for ${file}`);
    return fsp.lstat(file).then(stats => {
        let read, mode;
        if (stats.isSymbolicLink()) {
            read = fsp.readlink(file);
            mode = MODE_SYMLINK;
        } else {
            read = fsp.readFile(file);
            mode = MODE_FILE;
        }
        return read.then(content =>  uploadBlobContent(owner, repo, content))
            .then(sha => {
                return {sha: sha, mode: mode}
            })
    });
}

function uploadBlobContent(owner, repo, content) {
    let b64 = new Buffer(content).toString('base64');
    let body = {
        content: b64,
        encoding: 'base64'
    };
    return reqp({
        url: `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        method: 'POST',
        body: body
    }).then(resp => {
        return resp.sha;
    });
}

function createTree(owner, repo, contents) {
    console.log(`creating tree in ${owner} ${repo} with contents:`, contents);

    return reqp({
        url: `https://api.github.com/repos/${owner}/${repo}/git/trees`,
        method: 'POST',
        body: {
            tree: contents
        }
    }).then(resp => {
        return resp.sha;
    });
}

function createCommit(owner, repo, commit) {
    console.log(`creating commit in ${owner} ${repo}:`, commit);
    return reqp({
        url: `https://api.github.com/repos/${owner}/${repo}/git/commits`,
        method: 'POST',
        body: commit
    }).then(resp => {
        console.log(`created commit ${resp.sha}`);
        return resp.sha;
    });
}

function updateRef(owner, repo, ref, sha) {
    console.log(`updating ref ${ref} in ${owner} ${repo} to ${sha}`);
    return reqp({
        method: 'PATCH',
        url: `https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`,
        body: {
            sha: sha
        }
    }).then(response => {
        console.log(`updated ref ${ref}`)
    });
}

function downloadTarball(owner, repo, ref, dest) {
    return req.then(client => {
        return getTarball(`https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`, dest, {
            httpClient: client
        });
    });
}

function getTree(owner, repo, treeSha) {
    return reqp(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}`);
}
