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

const type = require('type-detect');

exports.normalize = function normalize(config) {
    config.resources = normalizeResources(config.resources);
    return config;
};


function normalizeResources(resources) {
    if (!resources || resources.size === 0) {
        return [{
            src: './**'
        }];
    }
    return resources.map(it => {
        let src = null, dest = null;

        let t = type(it);
        if (t === 'string') {
            src = it;
        } else if (t === 'Object') {
            src = it.src;
            dest = it.dest;
        }
        let result = {
            src,
            dest
        };

        if (it.rename) {
            result.rename = it.rename;
        }

        return result;
    });
}