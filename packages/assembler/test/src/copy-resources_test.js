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

// const {describe, it} = require('mocha');
const chai = require('chai');

chai.use(require('chai-fs'));
chai.use(require('chai-as-promised'));
chai.use(require('../fixtures/assertFileStructure'));

const {expect} = chai;

const fs = require('fs-extra');

const tmp = require('tmp');
const path = require('path');

const subject = require('../../src/copy-resources');

tmp.setGracefulCleanup();

describe('copy-resources', function () {

    let sourceBase;
    let assembledBase;
    let sourceDirs;

    let addActions = {
        foo: {
            add: new Set(['test']),
            update: new Set()
        }
    };

    let updateActions = {
        foo: {
            add: new Set(['test']),
            update: new Set()
        }
    };

    before(async function () {
        let tmpdir = tmp.dirSync({unsafeCleanup: true});
        sourceBase = path.join(tmpdir.name, 'work');
        assembledBase = path.join(tmpdir.name, 'assembled');

        await fs.emptyDir(sourceBase);
        await fs.emptyDir(assembledBase);
        sourceDirs = await initFilesystem(sourceBase);
    });

    it('should copy added versions', async function () {
        let manifest = makeManifest({
            src: 'a'
        });

        await subject(manifest, addActions, sourceDirs, assembledBase);

        expect(assembledBase).to.have.fileStructure({
            foo: {
                test: {
                    _: ['a']
                }
            }
        });
    });

    it('should copy updated versions', async function () {
        let manifest = makeManifest({
            src: 'a'
        });

        await subject(manifest, updateActions, sourceDirs, assembledBase);

        expect(assembledBase).to.have.fileStructure({
            foo: {
                test: {
                    _: ['a']
                }
            }
        });
    });

    it('should only copy specified resources', async function () {
        let manifest = makeManifest({
            src: 'a'
        });

        await subject(manifest, addActions, sourceDirs, assembledBase);

        expect(path.join(assembledBase, 'foo', 'test'))
            .to.be.a.directory().and.not.have.files(['b']);
    });

    it('should move resources with a `dest` attribute', async function () {
        let manifest = makeManifest({
            src: './1/c*',
            dest: './subdir'
        });

        await subject(manifest, addActions, sourceDirs, assembledBase);

        expect(assembledBase).to.have.fileStructure({
            foo: {
                test: {
                    subdir: {
                        _: ['c'],
                    },
                },
            },
        });
    });

    it('should copy entire directory structures', async function () {
        let manifest = makeManifest({
            src: '**/*'
        });

        await subject(manifest, addActions, sourceDirs, assembledBase);

        expect(assembledBase).to.have.fileStructure({
            foo: {
                test: {
                    _: ['a', 'b'],
                    '1': {
                        _: ['c'],
                        '2': {
                            _: ['d'],
                        },
                    },
                },
            },
        });
    });

    describe('rename', function () {
        it('should rename resources with a `rename` attribute', async function () {
            let manifest = makeManifest({
                src: '**/*',
                rename: [
                    {
                        regex: '(a)',
                        to: '$1-moved'
                    },
                    {
                        regex: '(c)',
                        to: '$1-c-moved'
                    }
                ]
            });

            await subject(manifest, addActions, sourceDirs, assembledBase);

            expect(assembledBase).to.have.fileStructure({
                foo: {
                    test: {
                        _: ['a-moved', 'b'],
                        '1': {
                            _: ['c-c-moved'],
                            '2': {
                                _: ['d'],
                            },
                        },
                    },
                },
            });
        });
        it('should rename handle multiple renames of the same file', async function () {
            let manifest = makeManifest({
                src: '**/*',
                rename: [
                    {
                        regex: '(a)',
                        to: '$1-moved'
                    },
                    {
                        regex: '(a)',
                        to: '$1-moved-again'
                    }
                ]
            });

            await subject(manifest, addActions, sourceDirs, assembledBase);

            expect(assembledBase).to.have.fileStructure({
                foo: {
                    test: {
                        _: ['a-moved', 'a-moved-again', 'b'],
                        '1': {
                            _: ['c'],
                            '2': {
                                _: ['d'],
                            },
                        },
                    },
                },
            });
        });

    });

    it('should error on an absolute `src`', async function () {
        let manifest = makeManifest({
            src: '/trying/to/read/secrets',
            dest: './'
        });

        let promise = subject(manifest, addActions, sourceDirs, assembledBase);

        return expect(promise).to.be.rejectedWith(/^Suspicious path pattern/);
        return expect(promise).to.be.rejectedWith(/^Suspicious path pattern '\/trying\/to\/read\/secrets'/);
    });

    it('should error on `src` that tries to escape the working directory', async function () {
        let manifest = makeManifest({
            src: '../some/secret/dir',
            dest: './'
        });

        let promise = subject(manifest, addActions, sourceDirs, assembledBase);

        return expect(promise).to.be.rejectedWith(/^Suspicious path pattern '..\/some\/secret\/dir'/);
    });

});

function makeManifest() {
    return {
        libraries: {
            foo: {
                versions: [
                    {
                        ref: 'test',
                        name: 'test',
                        config: {
                            resources: Array.from(arguments)
                        }
                    }
                ]
            }
        }
    };
}

async function initFilesystem(dir) {
    let result = {};
    for (let [lib, versions] of Object.entries(fakeFiles)) {
        let libResult = result[lib] = {};
        for (let [version, files] of Object.entries(versions)) {
            let verPath = path.join(dir, lib, version);
            libResult[version] = verPath;
            for (let [name, contents] of Object.entries(files)) {
                let filePath = path.join(verPath, path.normalize(name));

                await fs.outputFile(filePath, contents);
            }
        }
    }
    return result;
}

const fakeFiles = {
    foo: {
        test: {
            'a': 'a',
            'b': 'b',
            '1/c': 'c',
            '1/2/d': 'd'
        }
    }
};
