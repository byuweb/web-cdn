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
const sinon = require('sinon');

const constants = require('../../src/constants');
const moment = require('moment-timezone');

const providers = require('../../src/providers');

const subject = require('../../src/assemble-manifest');

const sandbox = sinon.sandbox.create();

describe('assemble-manifest', function () {

    it('should fetch libraries from main config', async function () {
        let cfg = {
            libraries: {
                foo: {
                    source: 'github:foo/bar'
                },
                baz: {
                    source: 'test:baz'
                }
            }
        };

        sandbox.stub(providers, 'getProvider').callsFake((input, config) => {
            let r = refs[input];
            let c = configs[input];
            return {
                listRefs: sandbox.stub().returns(r),
                fetchMainConfig: sandbox.stub().returns(c),
                fetchLinks: sandbox.stub().returns({}),
            };
        });

        let result = await subject(cfg);

        expect(result).to.have.property('libraries').which.is.an('object')
            .which.includes.keys('foo', 'baz');

        expect(result.libraries.foo).to.include({name: 'foo bar', description: 'foo desc'});
            // .and.to.have.property('versions').which.deep.includes(...refs['github:foo/bar']);

        expect(result.libraries.foo).to.have.property('aliases').which.deep.equals({
            '1.x.x': '1.0.0',
            '1.0.x': '1.0.0',
            'latest': '1.0.0'
        });


        expect(result.libraries.baz).to.include({name: 'baz', description: 'baz desc'});
            // .and.to.have.property('versions').which.deep.includes(...refs['test:baz']);
        expect(result.libraries.baz).to.have.property('aliases').which.deep.equals({
            '2.x.x': '2.0.0',
            '2.0.x': '2.0.0',
            'latest': '2.0.0'
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

});

let refs = {
    'github:foo/bar': [
        ref('test', 'test', constants.REF_TYPES.BRANCH),
        ref('v1.0.0', '1.0.0', constants.REF_TYPES.RELEASE)
    ],
    'test:baz': [
        ref('2.0.0', '2.0.0', constants.REF_TYPES.RELEASE)
    ],
};

function ref(ref, name, type) {
    const path = '/' + name + '/' + (type === 'release' ? '' : 'experimental/') + ref + '/';
    return {
        ref,
        name,
        type,
        source_sha: ref + ' sha',
        last_updated: moment(),
        tarball_url: ref + '.tgz',
        link: 'example.com/' + ref,
        config: {
            resources: []
        },
        path,
        manifest_path: path + '.cdn-meta/version-manifest.json',
    }
}

let configs = {
    'github:foo/bar': {
        name: 'foo bar',
        description: 'foo desc',
        docs: 'example.com/foo/docs'
    },
    'test:baz': {
        name: 'baz',
        description: 'baz desc',
        docs: 'example.com/baz/docs'
    }
};
