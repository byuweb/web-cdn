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


import { parseElfFile } from './elf-parser';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { schema } from './parequetify';
import { ParquetWriter } from 'parquets';
import ReadStream = NodeJS.ReadStream;
import moment from 'moment';
import {URL} from 'url';

// const input = createReadStream('../examples/short.log');
// const input = createReadStream('../examples/real-log.log');

const input: ReadStream = createReadStream('../examples/real-log.log.gz')
    .pipe(createGunzip());

function parseReferrer(value: string | undefined) {
    if (!value) return {origin: null, referrer: null};

    let cleanedValue = value.includes('?') ? value.split('?')[0] : value;

    const parsed = new URL(cleanedValue);

    return {
        origin: parsed.origin,
        referrer: parsed.toString()
    }
}

(async () => {
    const lines = await parseFile(input);

    let writer = await ParquetWriter.openFile(schema, 'lines.parquet');

    for (const l of lines) {
        const rq = l.request;
        const ua = rq.userAgent;

        const referrer = parseReferrer(rq.referrer);

        await writer.appendRow({
            date: moment(l.date + 'T' + l.time + 'Z').toDate(),
            edge_location: l.edgeLocation,
            response: {
                size: l.response.size,
                status: l.response.status,
                type: l.response.type,
                initial_type: l.response.initialType,
            },
            user_agent: {
                ua: ua.ua,
                browser: ua.browser.name,
                browser_version: ua.browser.version,
                browser_major: ua.browser.major,
                os: ua.os.name,
                os_version: ua.os.version,
                device_type: ua.device.type,
                device_vendor: ua.device.vendor,
                device_model: ua.device.model,
            },
            request: {
                ip: rq.ip,
                method: rq.method,
                path: rq.path,
                origin: referrer.origin,
                referrer: referrer.referrer,
                protocol: rq.protocol,
            },
            ssl: {
                protocol: rq.ssl.protocol,
                cipher: rq.ssl.cipher,
            },
            http_version: rq.httpVersion,
            duration: l.duration
        });
    }

    await writer.close();
})().catch(err => console.error(err));

function parseFile(input: ReadStream): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const lines: any[] = [];
        parseElfFile(input)
            .on('data', line => {
                lines.push(line);
            })
            .on('end', () => {
                resolve(lines);
            })
            .on('error', e => reject(e));
    });
}
