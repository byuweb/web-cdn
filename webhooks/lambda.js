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

const awsServerlessExpress = require('aws-serverless-express');

const webhooks = require('./webhooks');

const MAIN_CONFIG_REPO_ENV = 'CDN_MAIN_CONFIG_REPO';
const MAIN_CONFIG_BRANCH_ENV = 'CDN_MAIN_CONFIG_BRANCH';
const CODE_PIPELINE_NAME_ENV = 'CDN_ASSEMBLER_PIPELINE_NAME';
const SKIP_CALLER_VALIDATION_ENV = 'CDN_SKIP_CALLER_VALIDATION';

const options = {
    mainConfigRepo: process.env[MAIN_CONFIG_REPO_ENV],
    mainConfigBranch: process.env[MAIN_CONFIG_BRANCH_ENV],
    assemblerPipelineName: requireEnv(CODE_PIPELINE_NAME_ENV),
    skipCallerValidation: process.env[SKIP_CALLER_VALIDATION_ENV] === 'true',
};

const server = awsServerlessExpress.createServer(webhooks(options));

exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context);

function requireEnv(name) {
    let value = process.env[name];
    if (!value) {
        throw 'Invalid configuration; please define ' + name;
    }
}

