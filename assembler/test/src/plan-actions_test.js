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

const {expect} = require('chai');
const moment = require('moment');
const deepcopy = require('deepcopy');

const aliases = require('../../src/aliases');
const determineActions = require('../../src/plan-actions');


describe('plan-actions', function () {

    it('plans actions for each library and version', function () {
        let libOne = buildLib('one', ['1.0.0'], ['master', 'feature']);
        let libTwo = buildLib('two', ['0.1.0', '0.2.0'], ['master']);

        let m = manifest({
            [libOne.name]: libOne,
            [libTwo.name]: libTwo,
        });

        let result = determineActions(m, m);

        expect(result).to.not.be.null;

        expect(result).to.have.property(libOne.name).which.deep.equals({
            add: [],
            remove: [],
            update: [],
            deleteLib: false
        });

        expect(result).to.have.property(libTwo.name).which.deep.equals({
            add: [],
            remove: [],
            update: [],
            deleteLib: false
        });

    });

    describe('library changes', function () {
        it('plans adds for new libs', function () {
            let oldLib = buildLib('old', ['1.0.0'], ['master']);
            let addLib = buildLib('add', ['1.0.0'], ['master']);

            let one = manifest({
                [oldLib.name]: oldLib,
            });
            let two = manifest({
                [oldLib.name]: oldLib,
                [addLib.name]: addLib,
            });

            let result = determineActions(one, two);

            expect(result).to.not.be.null;
            expect(result).to.have.property(oldLib.name).which.deep.equals({
                add: [],
                remove: [],
                update: [],
                deleteLib: false
            });
            expect(result).to.have.property(addLib.name)
                .which.deep.equals({
                add: ['1.0.0', 'master'],
                remove: [],
                update: [],
                deleteLib: false
            });
        });

        it('plans removals for deleted libs', function () {
            let oldLib = buildLib('old', ['1.0.0'], ['master']);
            let removeLib = buildLib('remove', ['1.0.0'], ['master']);

            let one = manifest({
                [oldLib.name]: oldLib,
                [removeLib.name]: removeLib,
            });
            let two = manifest({
                [oldLib.name]: oldLib,
            });

            let result = determineActions(one, two);

            expect(result).to.not.be.null;
            expect(result).to.have.property(oldLib.name).which.deep.equals({
                add: [],
                remove: [],
                update: [],
                deleteLib: false
            });
            expect(result).to.have.property(removeLib.name)
                .which.deep.equals({
                add: [],
                remove: [],
                update: [],
                deleteLib: true
            });
        });

        it('does not plan updates for changes to library metadata', function () {
            let oldLib = buildLib('lib', ['1.0.0'], ['master']);
            let newLib = deepcopy(oldLib);

            newLib.name = 'new name';
            newLib.description = 'new descr';
            newLib.docs = 'https://example.com/changed';

            let result = determineActions(manifest({lib: oldLib}), manifest({lib: newLib}));

            expect(result).to.have.property('lib').which.deep.equals({
                add: [],
                remove: [],
                update: [],
                deleteLib: false
            });
        });
    });

    describe('version changes', function () {
        it('plans updates for changed versions', function () {
            let oldLib = buildLib('lib', ['1.0.0'], ['master', 'feature']);
            let newLib = deepcopy(oldLib);

            newLib.versions.find(it => it.name === 'feature').source_sha = 'changed';

            let result = determineActions(manifest({lib: oldLib}), manifest({lib: newLib}));

            expect(result).to.have.property('lib').which.deep.equals({
                add: [], remove: [], update: ['feature'],
                deleteLib: false
            });
        });

        it('plans removals for deleted versions', function () {
            let oldLib = buildLib('lib', ['1.0.0'], ['master', 'feature']);
            let newLib = deepcopy(oldLib);

            newLib.versions = newLib.versions.filter(it => it.name !== 'feature');

            let result = determineActions(manifest({lib: oldLib}), manifest({lib: newLib}));

            expect(result).to.have.property('lib').which.deep.equals({
                add: [], remove: ['feature'], update: [],
                deleteLib: false
            });
        });

        it('plans adds for new versions', function () {
            let oldLib = buildLib('lib', ['1.0.0'], ['master']);
            let newLib = deepcopy(oldLib);

            newLib.versions.push(libVer('feature', 'branch'));
            newLib.versions.push(libVer('1.0.1', 'release'));

            let result = determineActions(manifest({lib: oldLib}), manifest({lib: newLib}));

            expect(result).to.have.property('lib').which.deep.equals({
                add: ['feature', '1.0.1'], remove: [], update: [],
                deleteLib: false
            });
        });
    });

    describe('CDN version changes', function () {
        it('plans an update of all versions in all libs', function () {
            let libs = {
                one: buildLib('one', ['1.0.0'], ['master']),
                two: buildLib('two', ['1.0.0', '1.0.1'], ['master', 'feature']),
            };

            let oldManifest = manifest(libs);
            let newManifest = manifest(libs);

            newManifest['$cdn-version'] = newManifest['$cdn-version'] + '-changed';

            let result = determineActions(oldManifest, newManifest);

            expect(result).to.have.property('one').which.deep.equals({
                add: [], remove: [], update: ['1.0.0', 'master'],
                deleteLib: false
            });
            expect(result).to.have.property('two').which.deep.equals({
                add: [], remove: [], update: ['1.0.0', '1.0.1', 'master', 'feature'],
                deleteLib: false
            });
        });

        it('does not plan updates for refs that no longer exist', function () {
            let oldLibs = {
                lib: buildLib('lib', [], ['foo', 'bar']),
            };
            let newLibs = {
                lib: buildLib('lib', [], ['foo']),
            };

            let oldManifest = manifest(oldLibs);
            let newManifest = manifest(newLibs);

            newManifest['$cdn-version'] = newManifest['$cdn-version'] + '-changed';

            let result = determineActions(oldManifest, newManifest);

            expect(result).to.have.property('lib').which.deep.equals({
                add: [], remove: ['bar'], update: ['foo'], deleteLib: false
            });
        });
    });

});

const baseManifest = {
    '$cdn-version': '1.0.0',
    '$manifest-spec': 2,
    '$built': '2017-07-21T14:09:39-06:00',
    libraries: {}
};

function manifest(libraries) {
    let m = Object.assign({}, baseManifest);
    if (libraries) {
        m.libraries = Object.assign({}, m.libraries, libraries);
    }

    return m;
}

function buildLib(id, releases, branches) {
    return {
        source: 'github:test/' + id,
        name: id,
        description: `${id} descr`,
        docs: `https://github.com/test/${id}`,
        aliases: aliases(releases),
        versions: versions(releases, 'release').concat(versions(branches, 'branch'))
    };
}

function versions(ids, type) {
    return ids.map(it => libVer(it, type));
}

function libVer(id, type) {
    return {
        ref: id,
        name: id,
        type,
        source_sha: `${id}-sha`,
        last_update: moment(),
        tarball_url: `https://tarballs-r-us.com/${id}.tgz`,
        link: `https://devsites-r-us.com/${id}`,
        entrypoints: {
            'foo.js': `foo descr ${id}`
        }
    }
}


