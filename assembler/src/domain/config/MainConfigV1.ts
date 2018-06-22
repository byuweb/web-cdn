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

import { MainConfig as MainConfigBase } from './MainConfig';
import { LibraryConfig as LibraryConfigV1 } from './LibraryConfigV1';

export interface MainConfig extends MainConfigBase{
    cdn: CdnConfig
    libraries: MainConfigLibraries
    infrastructure: MainConfigInfrastructure
}

export interface CdnConfig {
    name: string
}

export interface MainConfigLibraries {
    [libId: string]: MainConfigLibrary
}

export interface MainConfigLibrary {
    source: string
    configuration?: LibraryConfigV1
    //TODO: Document NPM source configuration
}

//------ This part doesn't do anything yet, but I want to make it so
export interface MainConfigInfrastructure {
    environments: MainConfigEnvironments
}

export interface MainConfigEnvironments {
    [env: string]: MainConfigEnvironment
}

export interface MainConfigEnvironment {
    settings: MainConfigEnvironmentSettings
}


export interface MainConfigEnvironmentSettings {
    root_dns: string
    account_stack_name: string
    certificate_arn: string
}
