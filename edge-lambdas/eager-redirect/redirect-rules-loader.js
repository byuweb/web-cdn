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

const axios = require('axios');

const zlib = require('zlib');
const {promisify, TextDecoder} = require('util');
const gunzip = promisify(zlib.gunzip);

module.exports = async function load({host}) {
    const url = `https://${host}/.cdn-infra/redirects.json.gz`;

    console.log('Loading redirect rules from', url);

    const response = await axios.get(url, {responseType: 'arraybuffer'});

    console.log('Finished getting rules');

    const result = parseResult(response.data);

    console.log('Finished parsing rules');

    return result;
};

async function parseResult(buf) {
    const decompressed = await gunzip(buf);
    const str = new TextDecoder().decode(decompressed);
    return JSON.parse(str);
}
