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

const aliases = require('../../src/aliases');

describe("aliases", function () {
    it("should set major version aliases", function() {
        let result = aliases(['1.0.0', '1.0.1', '0.1.0', '1.0.1', '2.0.0', '2.1.0']);
        expect(result).to.have.property('0.x.x', '0.1.0');
        expect(result).to.have.property('1.x.x', '1.0.1');
        expect(result).to.have.property('2.x.x', '2.1.0');
    });
    it("should set minor version aliases", function() {
        let result = aliases(['1.0.0', '1.0.1', '1.1.0', '1.1.1', '1.1.2']);
        expect(result).to.have.property('1.0.x', '1.0.1');
        expect(result).to.have.property('1.1.x', '1.1.2');
    });
    it("should set the 'latest' alias", function() {
        let result = aliases(['1.0.0', '1.0.1']);
        expect(result).to.have.property('latest', '1.0.1');

        result = aliases(['1.0.0', '1.1.0']);
        expect(result).to.have.property('latest', '1.1.0');

        result = aliases(['1.0.0', '1.1.0', '2.0.0']);
        expect(result).to.have.property('latest', '2.0.0');
    });
    it("should ignore non-semver refs", function() {
        let result = aliases(['1.0.0', 'foo', 'bar']);
        expect(result).to.deep.equal({
            '1.x.x': '1.0.0',
            '1.0.x': '1.0.0',
            'latest': '1.0.0'
        });
    });
    it("should set the 'latest' tag, even if there are no semver refs", function() {
        let result = aliases(['foo', 'bar', 'master']);
        expect(result).to.have.property('latest', 'master');
    });
});
