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

const {expect} = require('chai');

const client = require('../../../src/util/http');
const constants = require('../../../src/constants');

const foobar = 'http://foobar.com';

describe('http client', () => {
    it('should provide an http client', () => {
        let result = client();
        expect(result).to.be.an('object');
        expect(result).to.have.a.property('get').that.is.an('asyncfunction');
        expect(result).to.have.a.property('stream').that.is.an('asyncfunction');
    });
    it('always sets a user agent', async function () {
        let echo = nock(foobar)
            .get('/')
            .matchHeader('User-Agent', constants.CDN.USER_AGENT)
            .reply(200, {});
        let result = client();

        await result.getJson(foobar);

        echo.done();
    });
    it('accepts a headers object', async function () {
        let echo = nock(foobar)
            .get('/')
            .matchHeader('x-foo-test', 'test')
            .reply(200, {});

        let http = client({
            headers: {'x-foo-test': 'test'}
        });

        await http.getJson(foobar);

        echo.done();
    });

    it('accepts a headers function', async function () {
        let echo = nock(foobar)
            .get('/')
            .matchHeader('x-foo-test', 'test')
            .reply(200, {});

        let http = client({
            headers: function () {
                return {'x-foo-test': 'test'}
            }
        });

        await http.getJson(foobar);

        echo.done();
    });

    it('accepts a headers async function/promise', async function () {
        let echo = nock(foobar)
            .get('/')
            .matchHeader('x-foo-test', 'test')
            .reply(200, {});

        let http = client({
            headers: async function () {
                return {'x-foo-test': 'test'}
            }
        });

        await http.getJson(foobar);

        echo.done();
    });
});
