/*
 *  @license
 *    Copyright 2018 Brigham Young University
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

const expect = require('chai').expect;

const index = require('../index');

describe('Header Modifier Lambda', () => {
    describe('Normal Operation', () => {
        it('Passes through the status', done => {
            index.handler(event({
                status: '123',
                headers: {}
            }), {}, (err, resp) => {
                expect(err).to.be.null;

                expect(resp).to.have.property('status', '123');

                done();
            });
        });
        it('removes x-amz-* headers', done => {
            index.handler(event({
                headers: {
                    'something-normal': 'bar',
                    'x-amz-something': 'value'
                }
            }), {}, (err, resp) => {
                expect(err).to.be.null;

                expect(resp).to.have.property('headers');
                const headers = resp.headers;
                expect(headers).to.have.property('something-normal');
                expect(headers).to.not.have.property('x-amz-something');

                done();
            });
        });
    });
});


function event(response) {
    const {status = 200, headers = {}} = response || {};

    const amazonHeaders = Object.keys(headers)
        .map(it => [it, headers[it]])
        .reduce((agg, [key, value]) => {
            agg[key.toLowerCase()] = [{
                key: key,
                value: value
            }];
            return agg;
        }, {});

    return {
        Records: [
            {
                cf: {
                    response: {
                        status: status,
                        headers: amazonHeaders
                    },
                }
            }
        ]
    }
}