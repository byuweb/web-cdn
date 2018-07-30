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

const spawn = require('child-process-promise').spawn;
const log = require('winston');
const {EOL} = require('os');

module.exports = function runCmd(tag, command, args) {
    let promise = spawn(command, args);
    let proc = promise.childProcess;

    proc.stdout.on('data', function (data) {
        data.toString().split(EOL).forEach(line => {
            log.debug(`[${tag}] stdout: `, line);
        });
    });
    proc.stderr.on('data', function (data) {
        data.toString().split(EOL).forEach(line => {
            log.warn(`[${tag}] stderr: `, line);
        });
    });
    return promise;
};