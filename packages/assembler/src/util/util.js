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

/**
 * Created by jmooreoa on 1/25/17.
 */
"use strict";

const semver = require('semver');
const crypto = require('crypto');
const decompress = require('decompress');

module.exports = {
    cleanRefName: cleanRefName,
    transformObject: transformObject,
    writeObjectPath: writeObjectPath,
    hash: hash,
    objectAsArray: objectAsArray
};


function cleanRefName(name) {
    let clean = semver.clean(name);
    return clean ? clean : name;
}

function transformObject(obj, func) {
    return Object.getOwnPropertyNames(obj)
        .reduce((result, prop) => {
                result[prop] = func(prop, obj[prop]);
                return result;
            },
            {}
        );
}

function writeObjectPath(obj, value, pathParts) {
    let current = pathParts[0];
    if (pathParts.length > 1) {
        let next = obj[current] = obj[current] || {};
        writeObjectPath(next, value, pathParts.slice(1));
    } else {
        obj[current] = value;
    }
}

function hash(algo, buffer) {
    let hash = crypto.createHash(algo);
    hash.update(buffer);
    let hashBuffer = hash.digest();
    return {
        base64: hashBuffer.toString('base64'),
        hex: hashBuffer.toString('hex')
    }
}

function objectAsArray(obj) {
    if (!obj) return [];
    return Object.getOwnPropertyNames(obj)
        .map(key => {
            return {
                key: key,
                value: obj[key]
            }
        });
}
