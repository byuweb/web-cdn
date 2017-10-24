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

module.exports = {

    isSuperset(set, subset) {
        for (let elem of subset) {
            if (!set.has(elem)) {
                return false;
            }
        }
        return true;
    },

    union(set, other) {
        let union = new Set(set);
        for (let e of other) {
            union.add(e);
        }
        return union;
    },

    intersection(set, other) {
        let inter = new Set();
        for (let e of other) {
            if (set.has(e)) {
                inter.add(e);
            }
        }
        return inter;
    },

    difference(set, other) {
        let diff = new Set(set);
        for (let e of other) {
            diff.delete(e);
        }
        return diff;
    },

};

