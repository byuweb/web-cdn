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

const path = require('path');
const fs = require('fs-extra');
const arrayEquals = require('array-equal');

module.exports = function assertFileStructure(chai, util) {
    console.log('setup fileStructure');
    let A = chai.Assertion;

    util.addChainableMethod(A.prototype, 'fileStructure', function fileStructure (structure) {
        let base = util.flag(this, 'object');

        checkDir(base, '/', structure);
    });

    function checkDir(dir, dirName, structure) {
        let expectedFiles = structure._ || [];

        let contents = fs.readdirSync(dir);

        let actualFiles = contents.filter(f => {
            let stat = fs.statSync(path.join(dir, f));
            return stat.isFile();
        });

        let actualDirs = contents.filter(f => {
            let stat = fs.statSync(path.join(dir, f));
            return stat.isDirectory();
        });

        let files = new A(actualFiles);
        files.assert(
            arrayEquals(files._obj, expectedFiles),
            `expected ${dirName} to have files #{exp}, but had #{act}`,
            `expected ${dirName} to have not files #{exp}, but had #{act}`,
            expectedFiles
        );

        let expectedDirs = Object.keys(structure).filter(k => k !== '_');

        let dirs = new A(actualDirs);
        dirs.assert(
            arrayEquals(dirs._obj, expectedDirs),
            `expected ${dirName} to have subdirs #{exp}, but had #{act}`,
            `expected ${dirName} to have not subdirs #{exp}, but had #{act}`,
            expectedFiles
        );

        for (let subdir of expectedDirs) {
            checkDir(path.join(dir, subdir), path.join(dirName, subdir), structure[subdir]);
        }
    }

};

