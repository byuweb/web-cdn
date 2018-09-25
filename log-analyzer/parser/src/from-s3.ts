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


import { LogRow, parseElfFile } from './elf-parser';
import { writeFile, writeJSON } from 'fs-extra';
import { createGunzip } from 'zlib';
import { allReports } from './reports';
import { S3 } from 'aws-sdk';
import recursive from 'recursive-readdir';

import PQueue from 'p-queue';
import ReadStream = NodeJS.ReadStream;
import { createReadStream } from 'fs';

async function processFile(input) {
    const reports = allReports();
    return new Promise((resolve, reject) => {
        parseElfFile(input.pipe(createGunzip()))
            .on('data', line => {
                Object.values(reports).forEach(rept => rept.consume(line));
            })
            .on('end', () => {
                const results = {};
                Object.values(reports).forEach(rept => {
                    return results[rept.name] = rept.getResult();
                });
                resolve(results);
            })
            .on('error', e => {
                reject(e);
            });
    });
}

const s3 = new S3();

const bucket = 'web-community-cdn-prod-logs-us-east-1-427927161742';
// const prefix = 'cloudfront/preprocessed/2018-08/18/09:00';
const prefix = 'cloudfront/preprocessed';

async function listAllWithPrefix(bucket: string, prefix: string): Promise<string[]> {
    // const keys: string[] = [];
    // let continuation: string | undefined = undefined;
    // do {
    //     const params = {
    //         Bucket: bucket,
    //         Prefix: prefix,
    //         ContinuationToken: continuation
    //     };
    //     const objects = await s3.listObjectsV2(params).promise();
    //     continuation = objects.NextContinuationToken;
    //     const theseKeys = objects.Contents!.map(it => it.Key);
    //     keys.push(...theseKeys);
    // } while (continuation);
    // return keys;

    return await recursive('actuals/2018-08/28');

}

(async () => {
    const keys = await listAllWithPrefix(bucket, prefix);

    console.error('Found', keys.length, 'files');

    const aggregatedResults = {};

    // const queue = new PQueue({concurrency: 10});
    const queue = new PQueue({concurrency: 1});

    for (const key of keys) {
        queue.add(async () => {
            console.log('processing', key);
            // const contentStream = s3.getObject({
            //     Bucket: bucket,
            //     Key: key
            // }).createReadStream();
            const contentStream = createReadStream(key);

            const results = await processFile(contentStream);
            Object.entries(allReports())
                .forEach(([name, report]) => {
                    const already = aggregatedResults[name];
                    if (!results[name]) {
                        return;
                    }
                    if (already) {
                        aggregatedResults[name] = report.aggregate(already, results[name])
                    } else {
                        aggregatedResults[name] = results[name];
                    }
                });
        });
    }

    await queue.onIdle();

    for (const [name, report] of Object.entries(allReports())) {
        const results = aggregatedResults[name];
        const rendered = report.render(results);
        await writeFile(name + '.' + report.renderedExtension, rendered);
        // if (result instanceof Set) {
        //     await writeJSON(report + '.json', [...result], {spaces: 2});
        // }
        // await writeJSON(report + '.json', result, {spaces: 2});
    }

})().catch(err => console.error(err));

