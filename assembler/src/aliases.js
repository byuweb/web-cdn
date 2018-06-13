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

const semver = require('semver');

const constants = require('./constants');

module.exports = function computeAliases(refs) {
    let semvers = refs.filter(semver.valid);
    let aliases = semvers.reduce((set, each) => {
        let major = semver.major(each);
        let minor = semver.minor(each);
        set.add(`${major}.x.x`);
        set.add(`${major}.${minor}.x`);
        return set;
    }, new Set());

    let result = [...aliases].reduce((obj, alias) => {
        obj[alias] = semver.maxSatisfying(semvers, alias);
        return obj;
    }, {});

    let hasMasterBranch = refs.includes('master');

    if (hasMasterBranch) {
        result[constants.VERSION_ALIASES.MASTER] = 'master';
    }

    let latestRelease = semver.maxSatisfying(semvers, '*');
    if (latestRelease) {
        result.latest = latestRelease;
    } else if (hasMasterBranch) {
        result.latest = 'master'
    }
    return result;
};