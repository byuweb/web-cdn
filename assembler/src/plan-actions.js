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
"use strict";

const sets = require('./util/sets');
const log = require('winston');

module.exports = function diffManifest(buildContext, oldManifest, newManifest) {
    const {forceBuild} = buildContext;
    let allLibs = new Set([].concat(
        Object.keys(oldManifest.libraries),
        Object.keys(newManifest.libraries)
    ));

    if (forceBuild) {
        log.info('Forcing update to all versions');
    }

    let diff = {};

    allLibs.forEach(libId => {
        if (!newManifest.libraries.hasOwnProperty(libId)) {
            diff[libId] = {
                add: [],
                remove: [],
                update: [],
                deleteLib: true
            };
            return;
        }

        let oldVers = (oldManifest.libraries[libId] || {}).versions || [];
        let newVers = (newManifest.libraries[libId] || {}).versions || [];

        let oldVerIds = new Set(oldVers.map(verName));
        let newVerIds = new Set(newVers.map(verName));

        let addedVersions = sets.difference(newVerIds, oldVerIds);
        let removedVersions = sets.difference(oldVerIds, newVerIds);

        let updatedCandidates = sets.union(oldVerIds, newVerIds);
        let updatedVersions;

        if (forceBuild) {
            updatedVersions = sets.intersection(newVerIds, updatedCandidates);
        } else {
            updatedVersions = computeChangedVersions(updatedCandidates, oldVers, newVers);
        }

        diff[libId] = {
            add: [...addedVersions].filter(it => canUpdate(it, newVers)),
            update: [...updatedVersions].filter(it => canUpdate(it, newVers)),
            remove: [...removedVersions],
            deleteLib: false
        };
    });

    return diff;
};

function canUpdate(refName, allVersions) {
    const v = allVersions.find(it => refName === it.name);
    return !v.missing_source;
}

function computeChangedVersions(candidates, oldVers, newVers) {
    let c = [...candidates]
        .filter(id => {
            let old = oldVers.find(verNameIs(id));
            let new_ = newVers.find(verNameIs(id));

            if (!old || !new_) return false;
            return old.source_sha !== new_.source_sha;
        });
    return new Set(c);
}

function verName(ver) {
    return ver.name
}

function verNameIs(id) {
    return function (ver) {
        return ver.name === id;
    }
}


