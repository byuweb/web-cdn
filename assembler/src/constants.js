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
 * Created by jmooreoa on 1/25/17.
 */
"use strict";

const freezer = require('deep-freeze-node');
const packageVersion = require('../package.json').version;

/**
 * @typedef {String} RefType
 */

/**
 */
module.exports = freezer({
    SOURCE_KEYS: {
        GITHUB: 'github',
        NPM: 'npm'
    },
    /**
     * @readonly
     * @enum {RefType}
     */
    REF_TYPES: {
        BRANCH: 'branch',
        /**
         * @deprecated
         */
        TAG: 'tag',
        RELEASE: 'release',
    },
    VERSION_ALIASES: {
        MASTER: 'unstable',
        LATEST: 'latest',
        EXPERIMENTAL_PREFIX: 'experimental'
    },
    CDN: {
        VERSION: packageVersion,
        GITHUB_ORG: 'byu-oit',
        GITHUB_REPO: 'web-cdn',
        CONTENT_BRANCH: 'content',
        USER_AGENT: 'BYU-Web-Community-CDN-Builder ' + packageVersion,
        MANIFEST_SPEC: '2'
    },
    S3: {
        BUCKET: process.env.DESTINATION_S3_BUCKET
    },
    RULES: {
        EXPERIMENTAL_DURATION: {
            days: 60
        }
    }
});


