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

const {NoopMessager} = require('../../src/messagers/index');

module.exports = function initFakeContext({
                                              config = {},
                                              assembledDir = '',
                                          } = {}) {
    return {
        config,
        // targetBucket,
        // dryRun,
        // forceBuild,
        directories: {
            // workDir,
            // sourceDir,
            assembledDir,
        },
        // cdnHost,
        // env,
        messages: new NoopMessager(),
        started: new Date(),
    };


    //     return {
    //     messages: new NoopMessager()
    // };
};
