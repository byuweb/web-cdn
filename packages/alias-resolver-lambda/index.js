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

const ALIAS_REGEX = /^\/(.*?)\/((?:(?:\d+\.(?:\d+|x)\.x)|latest|unstable))\//;

const CACHE_TIME_USER = 3600;
const CACHE_TIME_CACHE = 300;

let oldAliases;
let aliasCacheTime = 0;

const MAX_ALIAS_CACHE_TIME_MILLIS = 60 * 1000;

exports.redirectTest = async (event, context) => {
    console.log('Incoming Event', JSON.stringify(event, null, 2));
    const request = event.Records[0].cf.request;

    const uri = request.uri;

    const host = resolveHostName(request.headers.host[0].value, true);

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
        // } else if (file.startsWith('json-object')) {
        //     return await handleJsonObject(host, uri);
    } else {
        console.log('Not a known redirect type; passing through');
        return request;
    }
};

async function request(host, uri, parser) {
    const start = Date.now();
    const encoding = encodingFor(uri);
    const resp = await axios({
        url: `https://${host}${uri}`,
        responseType: encoding ? 'arraybuffer' : 'text'
    });
    const data = resp.data;
    let text;
    if (encoding === 'br') {
        text = (await brotli.decompress(data)).toString('utf8');
    } else if (encoding === 'il') {
        text = (await iltorb.decompress(data)).toString('utf8');
    } else if (encoding === 'gz') {
        text = (await gunzip(data)).toString('utf8');
    } else {
        text = data;
    }

    const parsed = parser(text);

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
            duration: Date.now() - start,
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
        text.split('\n').map(line => {
            const [type, from, status, to, cache] = line.split('\t');
            return {type, from, to, status, cache};
        });
    });
}

async function handleJsonArray(host, uri) {
    return request(host, uri, text => {
        if (typeof text === 'string') {
            return JSON.parse(text);
        }
        return text;
    });
}

async function handleJsonObject(host, uri) {

}

exports.handler = (event, context, callback) => {
    console.log('Incoming Event', JSON.stringify(event, null, 2));
    let request = event.Records[0].cf.request;

    let uri = request.uri;

    console.log('Incoming request to', uri);

    let match = ALIAS_REGEX.exec(uri);

    if (!match) {
        console.log('Not an alias; passing through');
        callback(null, request);
    } else {
        let libId = match[1];
        let aliasName = match[2];

        console.log(`Appears to be an alias: ${libId}@${aliasName}; getting alias config`);
        let host = resolveHostName(request.headers.host[0].value, true);

        let aliasConfigUrl = `https://${host}/.cdn-meta/aliases.json`;

        console.log('Loading', aliasConfigUrl);

        getAliasList(host).then(aliases => {
            console.log('got aliases', aliases);

            let lib = aliases[libId];
            if (!lib) {
                console.log(`No lib defined with id ${libId}; passing through`);
                callback(null, request);
                return;
            }

            let version = lib[aliasName];
            if (!version) {
                console.log(`No alias defined for ${libId}@${aliasName}; passing through`);
                callback(null, request);
                return;
            }

            let newUri = uri.replace(ALIAS_REGEX, `/$1/${version}/`);

            console.log('Redirecting to', newUri);

            let response = {
                status: '302',
                statusDescription: 'Found',
                headers: {
                    location: [{
                        key: 'Location',
                        value: newUri
                    }],
                    'cache-control': [{
                        key: 'Cache-Control',
                        value: `public, max-age=${CACHE_TIME_USER}, s-maxage=${CACHE_TIME_CACHE}`
                    }],
                    'x-byu-cdn-alias-target': [{
                        key: 'X-BYU-CDN-Alias-Target',
                        value: version
                    }],
                }
            };
            response.headers['access-control-allow-origin'] = [{
                key: 'Access-Control-Allow-Origin',
                value: '*'
            }];
            response.headers['access-control-allow-methods'] = [{
                key: 'Access-Control-Allow-Methods',
                value: 'GET, HEAD'
            }];
            response.headers['access-control-max-age'] = [{
                key: 'Access-Control-Max-Age',
                value: '86400'
            }];
            callback(null, response);
        }).catch(err => {
            console.log('Got error', err);
            callback(err);
        });
    }
};

const S3_WEBSITE_HOST = 's3-website-us-east-1.amazonaws.com';
const S3_SECURE_HOST = 's3.dualstack.us-east-1.amazonaws.com';

function resolveHostName(host, canUseCloudfront) {
    if (canUseCloudfront && config.rootDns) {
        return config.rootDns;
    }
    if (host.includes(S3_WEBSITE_HOST)) {
        return host.replace(S3_WEBSITE_HOST, S3_SECURE_HOST);
    }
    return host;
}

function getAliasList(host) {
    let aliasConfigUrl = `https://${host}/.cdn-meta/aliases.json`;

    if (oldAliases && Date.now() < aliasCacheTime + MAX_ALIAS_CACHE_TIME_MILLIS) {
        console.log('Aliases are cached');
        return Promise.resolve(oldAliases);
    } else {
        console.log('Cache has expired');
    }

    console.log('Loading aliases from', aliasConfigUrl);

    return fetch(aliasConfigUrl).then(response => {
        let aliases = response.json();
        oldAliases = aliases;
        aliasCacheTime = Date.now();
        return aliases;
    }).catch(err => {
        if (oldAliases) {
            console.error('Got error getting alias list, using old version', err);
            return oldAliases;
        }
        throw err;
    });
}
