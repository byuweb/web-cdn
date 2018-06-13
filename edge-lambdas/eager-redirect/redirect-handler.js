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

        const rules = await this.cache.get(() => this.redirectRulesLoader({host}));

        const pathParts = uri.split('/').filter(it => it.length > 0);

        const redirect = applyRules(rules, pathParts);

        if (redirect) {
            console.log('Got a redirect from ', redirect.from, 'to', redirect.to);
            const file = uri.replace(redirect.from, '');
            const destination = uri.replace(redirect.from, redirect.to);
            return {
                status: String(redirect.status),
                headers: getHeadersForRedirect(file, destination, redirect),
            }
        } else {
            console.log('No redirect');
            return request;
        }
    }

};

function getHeadersForRedirect(file, destination, redirect) {
    const headers = {
        Location: destination,
        'Cache-Control': redirect.cache,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Max-Age': '86400',
        'Timing-Allow-Origin': '*'
    };

    if (redirect.preload) {
        console.log('Computing preload headers for', file);
        const preload = buildPreload(file, redirect.preload);
        if (preload) {
            console.log('Sending Link header', preload);
            headers.Link = preload;
        }
    }

    return toAmzHeaders(headers);
}

function buildPreload(file, preload) {
    return preload[file];
}

function toAmzHeaders(headers) {
    return Object.entries(headers)
        .reduce((agg, [key, value]) => {
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

