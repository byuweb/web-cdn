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

const apply = require('../apply-rules.js');

describe('apply-rules', () => {
    describe('prefix rules', () => {
        it('handles simple cases', () => {
            const expected = 1;
            const bad = 2;
            const rules = {
                prefixes: {
                    'foo': {
                        'bar': {
                            '|target|': expected,
                        },
                        'baz': {
                            '|target|': bad,
                        },
                    },
                    'baz': {
                        'bar': {
                            '|target|': bad,
                        },
                    },
                }
            };

            const parts = ['foo', 'bar', 'baz'];

            const result = apply(rules, parts);

            expect(result).to.equal(expected);
        });
        it('finds the deepest match', () => {
            const shallow = 'shallow';
            const deep = 'deep';

            const rules = {
                prefixes: {
                    foo: {
                        '|target|': shallow,
                        bar: {
                            '|target|': deep,
                        },
                    },
                },
            };

            const parts = ['foo', 'bar', 'baz'];

            const result = apply(rules, parts);

            expect(result).to.equal(deep);
        });
    });
});

