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

const Glob = require('glob').Glob;
const glob2base = require('glob2base');

const DEFAULT_IGNORES = [
    '**/.git/**',
    '**/.cdn-config.yml',
    '**/.gitignore',
    '**/.circleci/**',
];

exports.match = function matchGlob(pattern, opts) {
    if (pattern.startsWith('./')) {
        pattern = pattern.substring(2);
    }

    const ignore = [].concat(DEFAULT_IGNORES);

    if (opts.ignore) {
        if (Array.isArray(opts.ignore)) {
            ignore.push(...opts.ignore);
        } else {
            ignore.push(opts.ignore);
        }
    }

    opts.ignore = ignore;

    let g = new Glob(pattern, opts);
    let base = glob2base(g);
    let promise = new Promise((resolve, reject) => {
        g.on('error', reject);
        g.on('end', resolve);
    });

    promise.base = base;
    return promise;
};

(function () {
    const path = require('path');
    const srcDir = path.join(__dirname, '../../.tmp/build-test-lib/master');
    exports.match('./**', {
        cwd: srcDir, root: srcDir, nodir: true, dot: true
    }).then(console.log);
})();
