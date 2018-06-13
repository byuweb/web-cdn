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

const nock = require('nock');
const yaml = require('node-yaml');

const {expect} = require('chai');

const GithubProvider = require('../../../src/providers/github-provider');
const constants = require('../../../src/constants');

describe('github provider', function () {

    GithubProvider.setCredentials('test', 'test')

    let provider = new GithubProvider('foo/bar', {});

    it('should have the right id', function () {
        expect(GithubProvider.id).to.equal('github');
    });

    it('should be able to parse a source string', function () {
        expect(provider).to.include({
            owner: 'foo',
            repo: 'bar'
        });
    });

    describe('listRefs', function () {
        it('should get branches and tags', async function () {
            nock('https://api.github.com')
                .post('/graphql', () => true)
                .reply(200, {
                    data: {
                        repository: {
                            branches: {
                                nodes: [{
                                    name: 'foo',
                                    commit: {
                                        sha: '1234',
                                        date: '2017-01-01T00:00:00Z'
                                    }
                                }]
                            },
                            tags: {
                                nodes: [{
                                    name: 'v42.0.0',
                                    commit: {
                                        sha: '4321',
                                        date: '2017-01-01T00:00:00Z'
                                    }
                                }]
                            }
                        }
                    }
                });
            fakeConfigFile('foo', 'bar', 'foo', {
                name: 'foo',
                description: 'desc',
                entrypoints: {
                    'foo.js': 'bar'
                }
            });
            fakeConfigFile('foo', 'bar', 'v42.0.0', {
                name: 'foo',
                description: 'desc',
                entrypoints: {
                    'foo.js': 'bar'
                }
            });

            let refs = await provider.listRefs();

            expect(refs).to.not.be.null;
            expect(refs).to.have.lengthOf(2);

            let foo = refs.find(it => it.ref === 'foo');
            let v42 = refs.find(it => it.ref === 'v42.0.0');

            expect(foo).to.exist;
            expect(foo).to.deep.include({
                ref: 'foo',
                name: 'foo',
                type: constants.REF_TYPES.BRANCH,
            });

            expect(v42).to.exist;
            expect(v42).to.deep.include({
                ref: 'v42.0.0',
                name: '42.0.0',
                type: constants.REF_TYPES.RELEASE,
            });
        });
    });

    describe('fetchRepoConfig', function() {
        it ('should get the contents of .cdn-config.yml for a given repo and ref', async function() {
            let config = {
                foo: 'foo',
                bar: 'bar',
                baz: true
            };

            fakeConfigFile('foo', 'bar', 'tag', config);

            let result = await provider.fetchRepoConfig('tag');

            expect(result).to.deep.equal(config);
        });
    });

});

function fakeConfigFile(owner, repo, ref, config) {
    let configString = yaml.dump(config);
    let configb64 = Buffer.from(configString).toString('base64');

    nock('https://api.github.com')
        .get(`/repos/${owner}/${repo}/contents/.cdn-config.yml?ref=${ref}`)
        .reply(200, {
            content: configb64,
            encoding: 'base64'
        })
}
