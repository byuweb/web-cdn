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

import { CdnLibraryType } from '../domain/CdnLibrary';
import { ConfigValidation } from './Validation';
import { LinkAs } from '../domain/dom-bits';

export interface LibraryConfigFile {
    '$config-version': number
}

export function validateLibraryConfig(config: LibraryConfigFileV1, validation: ConfigValidation) {
    if (!config.name) {
        validation.warning(`'name' is missing`)
    }
    if (config.type) {

    }
}

export type ConfigLibraryType = CdnLibraryType

export interface LibraryConfigFileV1 extends LibraryConfigFile {
    name: string
    description?: string
    type?: ConfigLibraryType
    resources?: ConfigResources
    show_in_directory?: boolean
    docs?: string
    basic_usage?: ConfigBasicUsage
    preload?: ConfigPreload
    deprecated?: string
    prerelease?: boolean
    aliases?: ConfigAliases
}

export type ConfigResources = ConfigResource[]

export type ConfigResource = string | AdvancedConfigResource

export interface AdvancedConfigResource {
    src: string
    dest?: string
    rename?: ConfigRenameRules
}

export type ConfigRenameRules = ConfigRenameRule[]

export interface ConfigRenameRule {
    regex: string
    to: string
}

export interface ConfigBasicUsage {
    head: ConfigBasicUsageHead
    body: string
}

export interface ConfigBasicUsageHead {
    meta: ConfigUsageHeadMeta[]
    preload: ConfigUsageHeadPreload[]
    styles: ConfigUsageHeadStyle[]
    scripts: ConfigUsageHeadScript[]
}

export interface ConfigUsageHeadMeta {
    name: string
    content: string
}

export type ConfigUsageHeadStyle = string | ConfigUsageHeadStyleDef

export interface ConfigUsageHeadStyleDef {
    href: string
    rel?: string
    media?: string
}

export interface ConfigUsageHeadPreload {
    href: string
    as?: LinkAs
}

export type ConfigUsageHeadScript = string | ConfigUsageHeadScriptDef

export interface ConfigUsageHeadScriptDef {
    src: string
    async?: boolean
    defer?: boolean
    nomodule?: boolean
    type?: 'module' | string
}

export interface ConfigPreload {
    [file: string]: ConfigPreloadRule[]
}

export type ConfigPreloadRule = string | ConfigLibPreloadRule | ConfigAbsolutePreloadRule

export interface ConfigLibPreloadRule {
    lib: string
    version: string
    file: string
    as?: LinkAs
}

export interface ConfigAbsolutePreloadRule {
    absolute: string
    as?: LinkAs
}

export interface ConfigAliases {
    redirect?: boolean
    cache?: ConfigAliasesCache
}

export interface ConfigAliasesCache {
    immutable?: boolean
}

