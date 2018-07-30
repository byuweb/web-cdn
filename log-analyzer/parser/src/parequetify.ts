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

import {ParquetSchema} from 'parquets';

export const schema = new ParquetSchema({
    date: {type: 'TIMESTAMP_MILLIS', compression: 'GZIP'},
    edge_location: {type: 'UTF8', compression: 'GZIP'},
    response: {
        fields: {
            size: {type: 'UINT_32', compression: 'GZIP'},
            status: {type: 'UINT_16', compression: 'GZIP'},
            type: {type: 'UTF8', compression: 'GZIP'},
            initial_type: {type: 'UTF8', compression: 'GZIP'},
        }
    },
    user_agent: {
        fields: {
            ua: {type: 'UTF8', compression: 'GZIP'},
            browser: {type: 'UTF8', optional: true, compression: 'GZIP'},
            browser_version: {type: 'UTF8', optional: true, compression: 'GZIP'},
            browser_major: {type: 'UTF8', optional: true, compression: 'GZIP'},
            os: {type: 'UTF8', optional: true, compression: 'GZIP'},
            os_version: {type: 'UTF8', optional: true, compression: 'GZIP'},
            device_type: {type: 'UTF8', optional: true, compression: 'GZIP'},
            device_vendor: {type: 'UTF8', optional: true, compression: 'GZIP'},
            device_model: {type: 'UTF8', optional: true, compression: 'GZIP'},
        }
    },
    request: {
        fields: {
            ip: {type: 'UTF8'},
            method: {type: 'UTF8', compression: 'GZIP'},
            path: {type: 'UTF8', compression: 'GZIP'},
            origin: {type: 'UTF8', optional: true, compression: 'GZIP'},
            referrer: {type: 'UTF8', optional: true, compression: 'GZIP'},
            protocol: {type: 'UTF8', compression: 'GZIP'},
        }
    },
    ssl: {
        fields: {
            protocol: {type: 'UTF8', optional: true, compression: 'GZIP'},
            cipher: {type: 'UTF8', optional: true, compression: 'GZIP'},
        }, optional: true
    },
    http_version: {type: 'UTF8', compression: 'GZIP'},
    duration: {type: 'FLOAT', compression: 'GZIP'}
});

