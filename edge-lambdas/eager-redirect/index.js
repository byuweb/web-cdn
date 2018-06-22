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
const config = require('./config.json');


const RedirectHandler = require('redirect-handler');

const handler = new RedirectHandler({
    defaultHost: config.rootDns,
});

exports.handler = function (event, context, callback) {
    console.log('Incoming Event', JSON.stringify(event, null, 2));

    let request = event.Records[0].cf.request;

    handler.handleRequest(request).then(
        result => callback(null, result),
        err => {
            console.error('Error processing request; continuing request', err);
            callback(null, request);
        }
    );
};
