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
import { CdnAliasRules, CdnResourceRule, IPreloadRule } from './CdnResources';
import { LinkAs } from './dom-bits';

export enum CdnVersionType {
    branch, release
}

export class CdnVersion {
    constructor(
        readonly name: string,
        readonly ref: CdnVersionRefInfo,
        readonly type: CdnVersionType,
        readonly deployment: Deployment,
        readonly documentation: LibraryDocumentation,
    ) {
    }
}

export class Deployment {
    constructor(
        // readonly path: string,
        // readonly manifestPath: string,
        readonly resourceRules: CdnResourceRule[],
        readonly aliasRules: CdnAliasRules,
        readonly preloadRules: IPreloadRule,
    ) {
    }
}

export class CdnVersionRefInfo {
    constructor(
        readonly link: string,
        readonly sourceLink: string,
        readonly sourceSha: string,
        readonly lastUpdated: Moment,
        readonly tarballUrl: string,
        readonly name: string,
    ) {
    }
}

export class LibraryDocumentation {
    constructor(
        readonly description?: string,
        readonly docsUrl?: string,
        readonly showInDirectory: boolean = true,
        readonly usage?: LibraryBasicUsage,
    ) {
    }
}

export interface LibraryBasicUsage {
    head: LibraryBasicUsageHead
    body: string
}

export interface LibraryBasicUsageHead {
    meta: LibraryUsageHeadMeta[]
    preload: LibraryUsageHeadPreload[]
    styles: LibraryUsageHeadStyle[]
    scripts: LibraryUsageHeadScript[]
}

export interface LibraryUsageHeadMeta {
    name: string
    content: string
}

export type LibraryUsageHeadStyle = string | LibraryUsageHeadStyleDef

export interface LibraryUsageHeadStyleDef {
    href: string
    rel?: string
    media?: string
}

export interface LibraryUsageHeadPreload {
    href: string
    as?: LinkAs
}

export type LibraryUsageHeadScript = string | LibraryUsageHeadScriptDef

export interface LibraryUsageHeadScriptDef {
    src: string
    async?: boolean
    defer?: boolean
    nomodule?: boolean
    type?: 'module' | string
}

