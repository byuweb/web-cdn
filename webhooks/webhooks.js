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

const express = require('express');
const githubHook = require('./lib/hooks/github-hook');
const mainConfigLoader = require('./lib/main-config-loader');

const bodyParser = require('body-parser');

module.exports = function initApp(opts) {
    let options = opts || {};

    const app = express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    app.use(injectMainConfig);

    app.use(logError);
    app.use(translateError);

    app.post('/github', githubHook(options));

    return app;


    function injectMainConfig(req, resp, next) {
        mainConfigLoader(options).then(config => {
            req.cdnConfig = config;
            next();
        }).catch(next);
    }
};

function logError(err, req, resp, next) {
    if (err.httpStatus) {
        console.error('Error: HTTP Status ' + err.httpStatus, err);
    } else {
        console.error('Unexpected Error', err);
    }
    next(err);
}


function translateError(err, req, resp, next) {
    resp.status(err.httpStatus || 500)
        .json({
            'error_name': err.name,
            'error_message': err.message
        });
    next(err);
}

