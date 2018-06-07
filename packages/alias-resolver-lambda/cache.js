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

"use strict";

module.exports = class Cache {
    constructor({ttl}) {
        this.value = undefined;
        this.timestamp = 0;

        this.ttl = ttl;
    }

    hasValue() {
        return this.value !== undefined && Date.now() < this.timestamp + this.ttl;
    }

    async get(worker) {
        if (this.hasValue()) {
            return this.value;
        }

        try {
            const result = await worker();
            this.value = result;
            this.timestamp = Date.now();
            return result;
        } catch (err) {
            if (this.value) {
                console.log('Error fetching new cache value. Using stale value.', err);
                return this.value;
            } else {
                throw err;
            }
        }
    }
};
