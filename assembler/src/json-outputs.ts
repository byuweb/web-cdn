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
import { CdnLibraryType } from './domain/CdnLibrary';

export interface JsonManifest {
    '$manifest-spec': number
    '$cdn-version': string,
    '$built': Moment
}

export interface JsonManifestV2 extends JsonManifest {
    libraries: JsonManifestLibrariesV2
}

export interface JsonManifestLibrariesV2 {
    [libId: string]: JsonManifestLibV2
}


export declare const enum VersionTypeV2 {
    branch = 'branch',
    release = 'release'
}

export interface JsonManifestLibV2 {

    source: string
    name: string
    description?: string
    type: CdnLibraryType
    aliases: JsonLibAliasesV2
    links: JsonLibLinksV2
    show_in_directory: boolean
    deprecated: boolean
    deprecation_message?: string
    versions: JsonVersionsV2

}

export type JsonVersionsV2 = JsonVersionV2[]

export interface JsonVersionV2 {
    ref: string
    name: string
    type: VersionTypeV2
    source_sha: string
    last_updated: Moment
    tarball_url?: string
    link: string
    config: any
    path: string
    manifest_path: string
    aliases: JsonVersionAliasesV2
}

export interface JsonVersionAliasesV2 {
    [alias: string]: JsonVersionAliasV2
}

export interface JsonVersionAliasV2 {
    path: string
    redirect: boolean
    cache_immutable: boolean
}

export interface JsonLibLinksV2 {
    source?: string
    issues?: string
    docs?: string
    readme?: string
}

export interface JsonLibAliasesV2 {
    [alias: string]: string
}

export interface JsonRedirects {

}

export interface JsonVersionManifest extends JsonManifest {
}

export interface JsonVersionManifestV2 extends JsonVersionManifest {
    resources: JsonVersionManifestResourcesV2
    resource_groups: JsonVersionManifestResourceGroupV2[]
    readme_path: string
}

export interface JsonVersionManifestResourcesV2 {
    [path: string]: JsonVersionManifestResourceV2
}

export interface JsonVersionManifestResourceV2 {
    type: string
    size: JsonVersionManifestResourceSizeV2
    hashes: JsonVersionManifestResourceHashesV2
}

export interface JsonVersionManifestResourceGroupV2 {
    base_file: string
    variants: JsonVersionManifestResourceVariantsV2
}

export interface JsonVersionManifestResourceVariantsV2 {
    [variant: string]: string
}

export interface JsonVersionManifestResourceSizeV2 {
    compressible: true
    unencoded: number
    gzip?: number
}

export interface JsonVersionManifestResourceHashesV2 {
    sha256: JsonVersionManifestResourceHashV2
    sha384: JsonVersionManifestResourceHashV2
    sha512: JsonVersionManifestResourceHashV2
}

export interface JsonVersionManifestResourceHashV2 {
    base64: string
    hex: string
}

