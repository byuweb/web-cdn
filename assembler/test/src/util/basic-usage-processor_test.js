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

const process = require('../../../src/util/basic-usage-processor');
const {expect} = require('chai');
const {html, stripIndent} = require('common-tags');

const fakeBase = 'https://fake.cdn.byu.edu/lib/version/';

describe('basic-usage-processor', () => {
    describe('head', () => {
        it('Should leave string values alone', () => {
            const headInput = '  somestring\n<p>another line</p>  ';
            const {head} = process({
                head: headInput
            }, fakeBase);
            expect(head).to.equal(headInput)
        });
        it('should handle a complicated example', () => {
            const headInput = {
                meta: [{
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1.0'
                }],
                preload: [
                    {href: 'byu-theme-components.min.css', as: 'style'},
                    {href: 'byu-theme-components.min.js', as: 'script'},
                    'some-font.ttf'
                ],
                styles: [
                    'https://cloud.typography.com/75214/6517752/css/fonts.css',
                    'byu-theme-components.min.css'
                ],
                scripts: [
                    {
                        src: 'byu-theme-components.min.js',
                        async: true
                    },
                    {
                        src: 'module.js',
                        type: 'module'
                    },
                    {
                        src: 'nomodule.js',
                        nomodule: true
                    }
                ]
            };

            const { head } = process({
                head: headInput
            }, fakeBase);

            expect(head).to.equal(stripIndent`
                <!-- Preload Resources -->
                <link rel="preload" href="https://fake.cdn.byu.edu/lib/version/byu-theme-components.min.css" as="style" type="text/css">
                <link rel="preload" href="https://fake.cdn.byu.edu/lib/version/byu-theme-components.min.js" as="script" type="application/javascript">
                <link rel="preload" href="https://fake.cdn.byu.edu/lib/version/some-font.ttf" as="font" type="font/ttf" crossorigin="anonymous">
                
                <!-- Meta -->
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                
                <!-- Stylesheets -->
                <link rel="stylesheet" href="https://cloud.typography.com/75214/6517752/css/fonts.css" type="text/css">
                <link rel="stylesheet" href="https://fake.cdn.byu.edu/lib/version/byu-theme-components.min.css" type="text/css">
                
                <!-- Scripts -->
                <script src="https://fake.cdn.byu.edu/lib/version/byu-theme-components.min.js" async type="application/javascript"></script>
                <script src="https://fake.cdn.byu.edu/lib/version/module.js" type="module"></script>
                <script src="https://fake.cdn.byu.edu/lib/version/nomodule.js" nomodule type="application/javascript"></script>
            `);
        });
        it('Should process meta tags', () => {
            const headInput = {
                meta: [{
                    name: 'foo',
                    content: 'bar'
                }]
            };
            const {head} = process({
                head: headInput
            }, fakeBase);
            expect(head).to.equal(html`
            <!-- Meta -->
            <meta name="foo" content="bar">
            `)
        });
    });
});
