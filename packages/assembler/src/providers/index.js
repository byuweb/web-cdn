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

const providers = [
    require('./github-provider'),
    require('./npm-provider')
].reduce((map, src) => {
    map[src.id] = src;
    return map
}, {});

/**
 *
 * @param {string} sourceString
 * @param {{}} [libConfig]
 */
exports.getProvider = function getProvider(sourceString, libConfig) {
    let [source, value] = sourceString.split(':', 2);
    let ctor = providers[source];

    if (!ctor) {
        throw new Error('Could not find provider for type: ' + source);
    }
    return new ctor(value, libConfig || {});
};
