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

// const fetch = require('node-fetch');
const axios = require('axios');
const config = require('./config.json');

const brotli = require('brotli');
const iltorb = require('iltorb');

const zlib = require('zlib');
const promisify = require('util').promisify;
const gunzip = promisify(zlib.gunzip);

const MAX_ALIAS_CACHE_TIME_MILLIS = 60 * 1000;

let cachedRedirectRules;
let redirectCacheTime = 0;

exports.handler = function (event, context, callback) {
    console.log('Incoming Event', JSON.stringify(event, null, 2));

    let request = event.Records[0].cf.request;

    const handler = redirectTest;
    // const handler = handleRedirects;

    handler(request, context).then(
        result => callback(null, result),
        err => callback(err)
    );
};

async function redirectTest(request, context) {
    const uri = request.uri;

    const host = resolveHostForRequest(request.headers.host[0].value, false);

    if (!uri.startsWith('/redirects/')) {
        console.log('Not a redirect request; passing through');
        return request;
    }

    const parts = uri.split('/').filter(it => !!it);

    const file = parts[1];

    if (file.startsWith('text')) {
        return await handleText(host, uri);
    } else if (file.startsWith('json-array')) {
        return await handleJsonArray(host, uri);
    } else if (file.startsWith('json-object')) {
        return await handleJsonObject(host, uri);
    } else {
        console.log('Not a known redirect type; passing through');
        return request;
    }
}

async function request(host, uri, parser) {
    const start = Date.now();
    const encoding = encodingFor(uri);
    const resp = await axios({
        url: `https://${host}${uri}`,
        responseType: encoding ? 'arraybuffer' : 'text'
    });
    const requestEnd = Date.now();
    const data = resp.data;
    let text;
    if (encoding === 'brotli') {
        text = Buffer.from((await brotli.decompress(data)).buffer).toString('utf8');
    } else if (encoding === 'iltorb') {
        text = Buffer.from((await iltorb.decompress(data)).buffer).toString('utf8');
    } else if (encoding === 'gzip') {
        text = Buffer.from((await gunzip(data)).buffer).toString('utf8');
    } else {
        text = data;
    }

    const parsed = parser(text);
    const parseEnd = Date.now();
    return {
        status: '200',
        statusDescription: 'OK',
        headers: {
            'content-type': [{
                key: 'Content-Type',
                value: 'application/json'
            }],
            'cache-control': [{
                key: 'Cache-Control',
                value: 'no-cache'
            }]
        },
        body: JSON.stringify({
            timing: {
                total: parseEnd - start,
                request: requestEnd - start,
                parse: parseEnd - requestEnd,
            },
            redirects: parsed,
        }),
    };
}

function encodingFor(uri) {
    if (uri.endsWith('.br')) {
        return 'brotli';
    } else if (uri.endsWith('.il')) {
        return 'iltorb';
    } else if (uri.endsWith('.gz')) {
        return 'gzip';
    }
    return null;
}

async function handleText(host, uri) {
    return request(host, uri, text => {
        const array = text.split('\n').map(line => {
            const [type, from, status, to, cache] = line.split('\t');
            return {type, from, to, status, cache};
        });
        return parseToTree(array);
    });
}

async function handleJsonArray(host, uri) {
    return request(host, uri, text => {
        let array = text;
        if (typeof text === 'string') {
            array = JSON.parse(text);
        }
        return parseToTree(array);
    });
}

async function handleJsonObject(host, uri) {
    return request(host, uri, text => {
        if (typeof text === 'string') {
            return JSON.parse(text);
        }
        return text;
    });
}

function parseToTree(array) {
    const prefixes = array.filter(it => it.type === 'prefix')
        .reduce((agg, {from, to, status, cache}) => {
            const pathParts = from.split('/').filter(it => it.length > 0);

            const leaf = pathParts.reduce((tree, part) => {
                return tree[part] = tree[part] || {}
            }, agg);

            leaf['|target|'] = {to, status, cache};

            return agg;
        }, {});

    return {prefixes};
}

async function handleRedirects(request, context) {
    const uri = request.uri;

    console.log('Incoming request to', uri);

    const rules = await getRedirectRules(request);

    const pathParts = uri.split('/').filter(it => it.length > 0);

    const redirect = findRedirect(rules, pathParts);

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
            })
        }
    } else {
        return request;
    }
}

function toAmzHeaders(headers) {
    return Object.entries(headers)
        .reduce((agg, {key, value}) => {
            agg[key.toLowerCase()] = [{
                key, value
            }];
            return agg;
        }, {});
}

function findRedirect(rules, pathParts) {
    const prefixMatch = findRedirectPrefix(rules.prefixes, pathParts);
    return prefixMatch;
}

function findRedirectPrefix(prefixRules, pathParts) {
    let current = prefixRules;
    let match = null;
    for (const part of pathParts) {
        if (part in current) {
            current = current[part];
            if ('|target|' in current) {
                match = current['|target|'];
            }
        } else {
            break;
        }
    }
    return match;
}

async function getRedirectRules(request) {
    if (cachedRedirectRules && Date.now() < redirectCacheTime + MAX_ALIAS_CACHE_TIME_MILLIS) {
        console.log('Redirects are cached');
        return cachedRedirectRules;
    }

    console.log('Cache has expired');

    const host = resolveHostForRequest(request, true);
    const ruleUrl = `https://${host}/.cdn-meta/redirects.txt`;

    console.log('Loading redirects from', ruleUrl);

    const response = await axios.get({
        url: ruleUrl,
        responseType: 'text'
    });

    const text = response.data;

    return parseToTree(parseRedirectRules(text));
}

function parseRedirectRules(text) {
    return text.split('\n')
        .filter(it => !!it)
        .map(it => it.split('\t'))
        .map(([type, from, to, status, cache]) => {
            return {type, from, to, status, cache}
        });
}

const S3_WEBSITE_HOST = 's3-website-us-east-1.amazonaws.com';
const S3_SECURE_HOST = 's3.dualstack.us-east-1.amazonaws.com';

function resolveHostForRequest(request, canUseCloudfront) {
    if (canUseCloudfront && config.rootDns) {
        return config.rootDns;
    }
    const host = request.headers.host[0].value;
    if (host.includes(S3_WEBSITE_HOST)) {
        return host.replace(S3_WEBSITE_HOST, S3_SECURE_HOST);
    }
    return host;
}

