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


import {parseElfFile} from './elf-parser';
import {createReadStream} from 'fs';
import {createGunzip} from 'zlib';

// const input = createReadStream('examples/short.log');
// const input = createReadStream('examples/real-log.log');

const input = createReadStream('examples/real-log.log.gz')
    .pipe(createGunzip());

const deviceTypes = new Set();
let lines = 0;

parseElfFile(input)
    .on('data', line => {
        if (line.request.userAgent.device.type) {
            deviceTypes.add(line.request.userAgent.device.type);
        }
        lines++;
    })
    .on('end', () => {
        console.log('device types:', deviceTypes);
        console.log('lines', lines);
    });


