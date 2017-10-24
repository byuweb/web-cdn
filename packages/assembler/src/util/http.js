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

const req = require('request');
const reqp = require('request-promise-native');
const fsp = require('fs-extra');
const log = require('winston');
const constants = require('../constants');

const defaultHeaders = {
    'User-Agent': constants.CDN.USER_AGENT
};


class HttpClient {

    constructor(headerProvider) {
        this.headerProvider = headerProvider;
    }

    async headers() {
        let h = await this.headerProvider();
        return Object.assign({}, defaultHeaders, h);
    }

    async get(uri) {
        log.debug(`Getting ${uri}`);
        let headers = await this.headers();
        return reqp({
            uri,
            headers
        });
    }

    async getJson(uri) {
        log.debug(`Getting JSON from ${uri}`);
        let headers = await this.headers();
        return reqp({
            uri,
            headers,
            json: true
        });
    }

    async stream(uri, destination) {
        log.debug(`Streaming content from ${uri} to ${destination}`);
        let headers = await this.headers();
        return new Promise((resolve, reject) => {
            let stream = fsp.createWriteStream(destination);
            req({uri, headers})
                .on('error', reject)
                .pipe(stream);
            stream.on('finish', () => {
                log.debug(`Finished streaming ${uri}`);
                resolve(destination);
            })
        });
    }
}

module.exports = function initClient(opts) {
    let {headers = null} = opts || {};

    let headerProvider = () => {};
    if (typeof headers === 'function') {
        headerProvider = headers;
    }
    if (typeof headers === 'object') {
        headerProvider = () => headers;
    }

    return new HttpClient(headerProvider);
};

