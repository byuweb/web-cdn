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
import { LinkAs } from '../domain/dom-bits';

export class LibraryConfig {
    constructor(
        readonly name: string,
        readonly type: CdnLibraryType,
        readonly resources: LibraryResources,
        readonly documentation: DocumentationConfig
    ) {}
}

export class DocumentationConfig {

    constructor(
        readonly description?: string,
        readonly docsUrl?: string,
        readonly showInDirectory: boolean = true,
    ) {
    }
}

export type LibraryResources = LibraryResource[]

export interface LibraryResource {
    src: string
    dest: string
    rename?: LibraryRenameRules
}

export type LibraryRenameRules = LibraryRenameRule[]

export interface LibraryRenameRule {
    regex: string
    to: string
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

