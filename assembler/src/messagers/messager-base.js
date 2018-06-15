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

const chalk = require('chalk');
const WIDTH = 40;

module.exports = class MessagerBase {

    constructor() {
        this._trigger = null;
        this._newVersions = [];
        this._updatedVersions = [];
        this._removedVersions = [];

        this._newLibs = [];
        this._updatedLibs = [];
        this._removedLibs = [];

        this._updatedAliases = [];
        this._warnings = [];
        this._errors = [];
    }

    buildTrigger({type, source}) {
        this._trigger = {type, source};
    }

    newVersion(ver) {
        this._newVersions.push(ver)
    }

    updatedVersion(ver) {
        this._updatedVersions.push(ver);
    }

    removedVersion(ver) {
        this._removedVersions.push(ver);
    }

    updatedAlias(alias) {
        this._updatedAliases.push(alias);
    }

    addedLib(lib) {
        this._newLibs.push(lib);
    }

    updatedLib(lib) {
        this._updatedLibs.push(lib);
    }

    deletedLib(lib) {
        this._removedLibs.push(lib);
    }

    warning({message}) {
        this._warnings.push(message);
    }

    error({message}) {
        this._errors.push(message);
    }

    _getElapsedTime(start) {
        return Number((Date.now() - start.getTime()) / 1000).toFixed(1);
    }

    sendToConsole(buildContext) {
        console.log(chalk.bold(header('Build Report', '=')) + '\n');

        console.log(`  Build took ${this._getElapsedTime(buildContext.started)} seconds\n`);

        this.__printErrors();
        this.__printWarnings();
        this.__printAddedLibs();
        this.__printUpdatedLibs();
        this.__printRemovedLibs();
    }

    __printErrors() {
        if (this._errors.length === 0) return;
        console.log(chalk.bgRed.whiteBright.bold(header('Errors', '*')));
        this._errors.forEach(it => {
            console.log(chalk`{red.bold | •} ${it}`)
        });
    }

    __printWarnings() {
        if (this._warnings.length === 0) return;
        console.log(chalk.bgYellow.whiteBright.bold(header('Warnings', '*')));
        this._warnings.forEach(it => {
            console.log(chalk`{yellow.bold | •} ${it}`)
        });
    }


    __printAddedLibs() {
        console.log(chalk.bgGreen.gray(header('Added Libs', '-')));
        this._newLibs.forEach(it => {
            [
                chalk.green(it.libId),
                ...this.__lib(it.libId)
            ].map(it => chalk.green('| ') + it)
                .forEach(it => console.log(it));
        });
    }

     __printUpdatedLibs() {
        console.log(chalk.bgBlue.whiteBright(header('Updated Libs', '-')));
        this._updatedLibs.forEach(it => {
            [
                chalk.blue(it.libId),
                ...this.__lib(it.libId)
            ].map(it => chalk.blue('| ') + it)
                .forEach(it => console.log(it));
        });
    }

    __printRemovedLibs() {
        console.log(chalk.bgMagenta.whiteBright(header('Removed Libs', '-')));
        this._removedLibs.forEach(it => {
            console.log(chalk`{magenta | ${it.libId}}`)
        });
    }

    __lib(id) {
        return [
            ...this._newVersions.filter(it => it.libId === id)
                .map(it => chalk.green(' + ') + it.versionId),
            ...this._updatedVersions.filter(it => it.libId === id)
                .map(it => chalk.blue(' ~ ') + it.versionId),
            ...this._removedVersions.filter(it => it.libId === id)
                .map(it => chalk.red(' - ') + it.versionId),
            ...this._updatedAliases.filter(it => it.libId === id)
                .map(it => chalk` {magenta A} ${it.aliasName} {bold ->} ${it.aliasTarget}`)
        ];
    }

};

function header(text, line) {
    const len = text.length;

    const half = (WIDTH - len) / 2;

    return line.repeat(Math.floor(half) - 1) +
        ' ' +
        text +
        ' ' +
        line.repeat(Math.ceil(half) - 1);
}
