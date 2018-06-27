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

import { MainConfig } from "./config/MainConfigV1";
import { Moment } from 'moment';
import { Messager } from './messagers';

export class BuildContext implements BuildContext {
    constructor(
        readonly config: MainConfig,
        readonly targetBucket: string,
        readonly dryRun: boolean,
        readonly forceBuild: boolean,
        readonly directories: any,
        readonly cdnHost: string,
        readonly env: string,
        readonly started: Moment,
        readonly messager: Messager,
    ) {
    }
}

export class BuildDirectories {
    constructor(
        readonly workDir: string,
        readonly sourceDir: string,
        readonly assembledDir: string,
    ) {
    }
}

