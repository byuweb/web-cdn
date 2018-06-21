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

const fsp = require('fs-extra');
const path = require('path');
const sets = require('./util/sets');
const globs = require('./util/globs');

const log = require('winston');

module.exports = async function assembleArtifacts(buildContext, manifest, actions, sourceDirs) {
    const { assembledDir } = buildContext.directories;

    await fsp.emptyDir(assembledDir);

    let promises = Object.entries(manifest.libraries).map(async function ([id, defn]) {
        let libDir = path.join(assembledDir, id);
        let libSource = sourceDirs[id];

        let libActions = actions[id];

        let versionsToCopy = sets.union(libActions.add, libActions.update);

        if (versionsToCopy === 0) {
            return;
        }

        await fsp.emptyDir(libDir);

        for (let verId of versionsToCopy) {
            let verDir = path.join(libDir, verId);
            await fsp.emptyDir(verDir);
            let ver = defn.versions.find(v => v.name === verId);
            let srcDir = libSource[ver.ref];

            for (let r of ver.config.resources) {
                let dest = r.dest ? path.join(verDir, r.dest) : verDir;
                log.debug(`copying ${r.src} to ${dest}`);

                if (isSuspiciousPath(srcDir, r.src)) {
                    throw Error(`Suspicious path pattern '${r.src}' in ${id}@${verId}`);
                }

                let renameRules = (r.rename || []).map(rule => {
                    let {regex: from, to} = rule;
                    return {regex: new RegExp(from), to};
                });

                let globMatch = globs.match(r.src, {cwd: srcDir, root: srcDir, nodir: true});

                let globBase = globMatch.base;

                let toMove = await globMatch;

                let moves = toMove.map(name => {
                    let from = path.join(srcDir, name);
                    let toBase = name.replace(globBase, "");
                    let to = path.join(dest, toBase);

                    let renames = renameRules.filter(r => {
                        return toBase.match(r.regex);
                    });
                    if (renames.length === 0) {
                        return [{
                            name,
                            from,
                            to
                        }];
                    } else {
                        return renames.map(r => {
                            return {
                                name,
                                from,
                                to: path.join(dest, toBase.replace(r.regex, r.to))
                            }
                        });
                    }
                }).reduce((acc, each) => {
                    return each.concat(acc);
                }, []);

                for (let move of moves) {
                    await fsp.copy(move.from, move.to);
                }
            }
        }
    });

    return Promise.all(promises);
};


function isSuspiciousPath(base, pathOrPattern) {
    if (pathOrPattern.split(path.sep).includes('.git')) {
        return true;
    }
    if (path.isAbsolute(pathOrPattern)) {
        return true;
    }
    let norm = path.normalize(path.join(base, pathOrPattern));
    return norm.indexOf(base) !== 0;
}
