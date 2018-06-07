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

const defaultRulesLoader = require('./redirect-rules-loader.js');
const Cache = require('./cache.js');
const applyRules = require('./apply-rules.js');

const DEFAULT_RULES_CACHE_TTL = 60 * 1000;

module.exports = class RedirectHandler {
    constructor({
                    defaultHost = null,
                    redirectRulesLoader = defaultRulesLoader,
                    cacheTTL = DEFAULT_RULES_CACHE_TTL,
                }) {
        this.defaultHost = defaultHost;
        this.redirectRulesLoader = redirectRulesLoader;

        this.cache = new Cache({ttl: cacheTTL});
    }

    async handleRequest(request) {
        const uri = request.uri;

        console.log('incoming request to', uri);

        const host = resolveHostForRequest(request, this.defaultHost, true);

        const rules = this.cache.get(() => this.redirectRulesLoader({host}));

        const pathParts = uri.split('/').filter(it => it.length > 0);

        const redirect = applyRules(rules, pathParts);

        if (redirect) {
            return {
                status: String(redirect.code),
                headers: toAmzHeaders({
                    Location: redirect.to,
                    'Cache-Control': redirect.cache,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD',
                    'Access-Control-Max-Age': '86400',
                    'Timing-Allow-Origin': '*'
                }),
            }
        } else {
            return request;
        }
    }

};

function toAmzHeaders(headers) {
    return Object.entries(headers)
        .reduce((agg, {key, value}) => {
            agg[key.toLowerCase()] = [{
                key, value
            }];
            return agg;
        }, {});
}

const S3_WEBSITE_HOST = 's3-website-us-east-1.amazonaws.com';
const S3_SECURE_HOST = 's3.dualstack.us-east-1.amazonaws.com';

function resolveHostForRequest(request, defaultHost, canUseCloudfront) {
    if (canUseCloudfront && defaultHost) {
        return defaultHost;
    }
    const host = request.headers.host[0].value;
    if (host.includes(S3_WEBSITE_HOST)) {
        return host.replace(S3_WEBSITE_HOST, S3_SECURE_HOST);
    }
    return host;
}

