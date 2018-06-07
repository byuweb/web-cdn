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

const Cache = require('../cache.js');

describe('Cache', () => {
    describe('when empty', () => {
        it('calls the provided worker', async () => {
            const expected = {};

            const cache = new Cache({
                ttl: 10
            });

            const actual = await cache.get(() => expected);
            expect(actual).to.equal(expected);
        });

        it(`doesn't say it has a value`, async () => {
            const cache = new Cache({ttl: 1000});

            expect(cache.hasValue()).to.be.false;
        });
    });
    describe('when populated and unexpired', () => {
        it('only calls the worker once during the cache lifetime', async () => {
            let calls = 0;
            const worker = function () {
                return calls++;
            };

            const cache = new Cache({
                ttl: 1000,
            });

            const initial = await cache.get(worker);

            const again = await cache.get(worker);

            expect(again).to.equal(initial);
        });
        it('says it has a value', async () => {
            const cache = new Cache({
                ttl: 1000,
            });

            await cache.get(() => 1);

            expect(cache.hasValue()).to.be.true;
        });
    });
    describe('when populated and expired', () => {
         it('calls the worker again', async () => {
            const worker = function () {
                return {};
            };

            const cache = new Cache({
                ttl: 10,
            });

            const initial = await cache.get(worker);

            await waitFor(20);

            const again = await cache.get(worker);

            expect(again).to.not.equal(initial);
        });
        it('says it has a value', async () => {
            const cache = new Cache({
                ttl: 10,
            });

            await cache.get(() => 1);

            await waitFor(20);

            expect(cache.hasValue()).to.be.false;
        });
        it('returns the stale value if the worker fails', async () => {
            let throwOnCall = false;

            const worker = function() {
                if (throwOnCall) {
                    throw 'Simulated Error';
                }
                return {};
            };

            const cache = new Cache({
                ttl: 10,
            });

            const initial = await cache.get(worker);

            await waitFor(20);

            throwOnCall = true;

            const again = await cache.get(worker);
            expect(again).to.equal(initial);
        });
    });
});

async function waitFor(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

