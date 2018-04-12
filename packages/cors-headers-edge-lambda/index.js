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

const redirectCodeHeader = 'x-amz-meta-cdn-redirect-code';
const redirectLocationHeader = 'x-amz-meta-cdn-redirect-location';
const preloadHeader = 'x-amz-meta-cdn-preload';

exports.handler = (event, context, callback) => {
    console.log('Incoming Event', JSON.stringify(event, null, 2));
    const response = event.Records[0].cf.response;

    const redirectCode = getHeader(response, redirectCodeHeader);
    const redirectLocation = getHeader(response, redirectLocationHeader);

    if (redirectCode && redirectLocation) {
        response.status = redirectCode;
        setHeader(response, 'Location', redirectLocation);

        removeHeader(response, redirectCode);
        removeHeader(response, redirectLocation);
    }

    const preload = getHeader(response, preloadHeader);
    if (preload) {
        const links = JSON.parse(preload);

        response.headers['link'] = links.map(link => {
            let value;
            if (typeof link === 'string') {
                value = `<${link}>; rel=preload`;
            } else {
                const flags = Object.keys(link).filter(k => k !== 'href')
                    .map(key => `${key}="${link[key]}"`);
                value = `<${link.href}>; rel=preload`;
                if (flags.length > 0) {
                    value = `${value}; ${flags.join('; ')}`;
                }
            }
            return {
                key: 'Link',
                value: value,
            }
        });

        removeHeader(response, preloadHeader);
    }

    setHeader(response, 'Access-Control-Allow-Origin', '*');
    setHeader(response, 'Access-Control-Allow-Methods', 'GET, HEAD');
    setHeader(response, 'Access-Control-Max-Age', '86400');

    console.log('Sending response', JSON.stringify(response, null, 2));
    callback(null, response);
};

function getHeader(response, name) {
    const array = response.headers[name.toLowerCase()];
    if (!array || array.length === 0) {
        return null;
    }
    return array[0].value;
}

function setHeader(response, name, value) {
    response.headers[name.toLowerCase()] = [{
       key: name,
       value: value,
    }];
}

function removeHeader(response, name) {
    delete response.headers[name.toLowerCase()];
}