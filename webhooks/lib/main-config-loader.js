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

const req = require('request-promise-native').defaults(require('./req-defaults'));
const yaml = require('node-yaml');
const path = require('path');
const fs = require('fs-extra');


module.exports = function loadConfig(options) {
    let localPath = path.join(process.cwd(), '..', 'main-config.yml');
    return fs.pathExists(localPath).then(hasLocal => {
        if (hasLocal) {
            return fs.readFile(localPath);
        } else {
            if (!options.mainConfigRepo || !options.mainConfigBranch) {
                throw new Error('must set both mainConfigRepo and mainConfigBranch');
            }
            return req({
                url: `https://raw.githubusercontent.com/${options.mainConfigRepo}/${options.mainConfigBranc}/main-config.yml`,
                json: false
            });
        }
    }).then(config => {
        return yaml.parse(config);
    });
};