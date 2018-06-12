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

const LinkHeader = require('http-link-header');
const log = require('winston');

const path = require('path');
const mime = require('mime');

module.exports = function computeLinkHeader(file, rules) {
    const rule = rules[file.name];
    if (!rule) {
        return false;
    }

    const header = new LinkHeader();

    for (const link of rule) {
        let value;
        if (isRelativePathLink(link)) {
            value = handleRelativePath(file, link);
        } else if (isAbsolute(link)) {
            value = handleAbsolute(file, link);
        } else if (isLib(link)) {
            value = handleLib(file, link);
        } else {
            log.warn(`Got a bad link spec, I don't know what to do with it.`, link);
            continue;
        }
        header.set({
            rel: 'preload',
            uri: value,
            as: link.as || guessType(value)
        });
        if (rule.module || looksLikeModule(value)) {
            header.set({
                rel: 'modulepreload',
                uri: value
            });
        }
    }
    return header.toString();
};

function looksLikeModule(value) {
    return value.endsWith('.mjs');
}

function guessType(value) {
    if (value.endsWith('.js')) {
        return 'script';
    } else if (value.endsWith('.css')) {
        return 'style';
    }
    const type = mime.getType(value);
    if (type.startsWith('image')) {
        return 'image';
    }
    if (type.includes('font')) {
        return 'font';
    }
    return 'fetch';
}


const URL_REGEX = /^http(s)?:\/\//;

function isRelativePathLink(link) {
    if (typeof link === 'string') {
        return !link.match(URL_REGEX);
    }
    return 'relative' in link;
}

function handleRelativePath(file, link) {
    let value;
    if (typeof link === 'string') {
        value = link;
    } else {
        value = link.relative;
    }
    return path.normalize(path.join(path.dirname(file.to), value)).replace(/\\/g, '/');
}

function isAbsolute(link) {
    if (typeof link === 'string') {
        return !!link.match(URL_REGEX);
    }
    return 'absolute' in link;
}

function handleAbsolute(file, link) {
    if (typeof link === 'string') {
        return link;
    }
    return link.absolute;
}

function isLib(link) {
    if (typeof link !== 'object') {
        return false;
    }
    return 'lib' in link && 'version' in link && 'file' in link;
}

function handleLib(file, link) {
    return `/${link.lib}/${link.version}/${link.file}`;
}


