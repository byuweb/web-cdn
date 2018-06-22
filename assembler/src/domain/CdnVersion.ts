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

import { Moment } from 'moment';
import { LibraryConfig } from './config/LibraryConfigV1';

export enum CdnVersionType {
    branch, release
}

export class CdnVersion {
    constructor(
        readonly name: string,
        readonly ref: CdnVersionRefInfo,
        readonly type: CdnVersionType,
        readonly path: string,
        readonly manifestPath: string,
        readonly config: LibraryConfig,
    ) {}
}

export class CdnVersionRefInfo {
    constructor(
        readonly link: string,
        readonly sourceLink: string,
        readonly sourceSha: string,
        readonly lastUpdated: Moment,
        readonly tarballUrl: string,
        readonly name: string,
        readonly config: LibraryConfig
    ) {}
}


