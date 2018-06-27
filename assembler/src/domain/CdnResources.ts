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



import { LinkAs } from './dom-bits';

export class CdnResourceRule {
    constructor(
        readonly src: string,
        readonly dest: string,
        readonly rename: CdnResourceRenameRules,
    ) {}
}

export type CdnResourceRenameRules = CdnResourceRenameRule[];

export class CdnResourceRenameRule {
    constructor(
        readonly regex: RegExp,
        readonly to: string,
    ) {}
}

export class CdnAliasRules {
    constructor(
        readonly redirect: boolean = true,
        readonly cacheImmutable: boolean = false,
    ) {}
}

export enum PreloadRuleType {
    LIB = 'lib',
    ABSOLUTE = 'absolute',
    RELATIVE = 'relative'
}

export type PreloadRule = RelativePreloadRule | AbsolutePreloadRule | LibReferencePreloadRule;

export interface IPreloadRule {
    type: PreloadRuleType
    as?: LinkAs
}

export class RelativePreloadRule implements IPreloadRule {
    readonly type = PreloadRuleType.RELATIVE;

    constructor(
        readonly relativePath: string,
        readonly as?: LinkAs,
    ) {}
}

export class AbsolutePreloadRule implements IPreloadRule {
    readonly type = PreloadRuleType.ABSOLUTE;

    constructor(
        readonly absoluteUrl: string,
        readonly as?: LinkAs,
    ) {}
}

export class LibReferencePreloadRule implements IPreloadRule {
    readonly type = PreloadRuleType.LIB;

    constructor(
        readonly lib: string,
        readonly version: string,
        readonly file: string,
        readonly as?: LinkAs,
    ) {}
}