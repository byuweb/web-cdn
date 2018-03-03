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

/**
 * Created by ThatJoeMoore on 1/25/17.
 */
"use strict";

const aws = require('aws-sdk');
const fs = require('fs-extra');
const path = require('path');

const os = require('os');

const ssm = new aws.SSM();

const log = require('winston');

module.exports = async function loadGithubCredentials(env) {
    let local = await fromLocalFile();
    if (local) {
        return local;
    }
    return await fromParameterStore(env);
};

async function fromLocalFile() {
    let possibleKeyDirs = [
        process.cwd(),
        path.resolve(path.join(__dirname, '..', '..')),
        os.homedir()
    ];

    let location = possibleKeyDirs.map(dir => path.join(dir, '.github-api-key.json')).find(file => {
        return fs.pathExistsSync(file);
    });

    if (location) {
        return await fs.readJson(location);
    }
}

async function fromParameterStore(env) {
    let prefix = `web-community-cdn.${env}`;
    let userParam = `${prefix}.github.user`;
    let tokenParam = `${prefix}.github.token`;

    let data = await ssm.getParameters({
        Names: [
            userParam, tokenParam
        ],
        WithDecryption: true
    }).promise();

    let invalid = data.InvalidParameters;
    if (invalid && invalid.length > 0) {
        log.warn(`Unable to look up Github credentials from AWS SSM: Invalid Parameters ${invalid.join(', ')}`);
        return null;
    }

    let user = data.Parameters.find(val => val.Name === userParam);
    let token = data.Parameters.find(val => val.Name === tokenParam);

    return {user: user.Value, token: token.Value};
}
