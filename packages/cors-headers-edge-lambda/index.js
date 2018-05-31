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

const REDIRECT_LOCATION_HEADER = 'x-amz-website-redirect-location';

const STATUS_HEADER = 'x-amz-meta-*status*';

const HEADER_PREFIX = 'x-amz-meta-*header*';
const HEADER_PREFIX_LENGTH = HEADER_PREFIX.length;

const REMOVED_HEADERS = ['date', 'last-modified', 'server'];

exports.handler = (event, context, callback) => {
    console.log('Incoming Event', JSON.stringify(event, null, 2));
    const request = event.Records[0].cf.request;

    console.log(`${request.method} ${request.uri}`);

    const response = event.Records[0].cf.response;

    let status = getHeader(response, STATUS_HEADER) || response.status;

    const redirect = getHeader(response, REDIRECT_LOCATION_HEADER);

    if (redirect) {
        if (!status) {
            status = 302;
        }
        setHeader(response, 'Location', redirect);
    }

    for (const key of Object.keys(response.headers)) {
        const values = response.headers[key];

        if (key.indexOf(HEADER_PREFIX) === 0) {
            const fixedKey = key.substring(HEADER_PREFIX_LENGTH);
            response.headers[fixedKey] = values.map(it => {
                return {
                    key: it.key.substring(HEADER_PREFIX_LENGTH),
                    value: it.value
                };
            });
        } else if (key.indexOf('x-amz-meta') !== 0 && !REMOVED_HEADERS.includes(key)) {
            continue;
        }
        delete response.headers[key];
    }

    response.status = status;

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

