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

import { S3Event } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { DateTime } from 'luxon';

const LOG_BUCKET = requireEnv('LOG_BUCKET');
const UNPROCESSED_PREFIX = requireEnv('UNPROCESSED_PREFIX');
const PREPROCESSED_PREFIX = requireEnv('PREPROCESSED_PREFIX');

export async function handler(event: S3Event) {
    console.log('event:', JSON.stringify(event, null, 2));
    const s3 = new S3();
    const promises: Promise<any>[] = [];
    for (const record of event.Records) {
        const eventTime = DateTime.fromISO(record.eventTime).toUTC();
        const {bucket, object} = record.s3;
        if (bucket.name !== LOG_BUCKET) {
            console.warn('Event from wrong log bucket: ', bucket.name, 'expected', LOG_BUCKET);
            continue;
        }
        if (!object.key.startsWith(UNPROCESSED_PREFIX)) {
            console.warn('File in wrong location in S3:', object.key);
        }

        const targetPrefix = `${PREPROCESSED_PREFIX}/${eventTime.toFormat('yyyy-LL/dd/HH')}:00/`;

        const sourceKey = object.key;

        const copyTo = targetPrefix + sourceKey.substring(PREPROCESSED_PREFIX.length);

        console.log('Copying from', sourceKey, 'to', copyTo);
        promises.push(s3.copyObject({
            CopySource: `${LOG_BUCKET}/${sourceKey}`,
            Bucket: LOG_BUCKET,
            Key: copyTo,
        }).promise());
    }

    await Promise.all(promises);
    console.log('Done');
}

function requireEnv(name: string): string {
    if (!(name in process.env)) {
        throw new Error('Missing required env var: ' + name);
    }
    return process.env[name] as string;
}


/*
PUT Object

{
   "Records":[
      {
         "eventVersion":"2.0",
         "eventSource":"aws:s3",
         "awsRegion":"us-east-1",
         "eventTime":"1970-01-01T00:00:00.000Z",
         "eventName":"ObjectCreated:Put",
         "userIdentity":{
            "principalId":"AIDAJDPLRKLG7UEXAMPLE"
         },
         "requestParameters":{
            "sourceIPAddress":"127.0.0.1"
         },
         "responseElements":{
            "x-amz-request-id":"C3D13FE58DE4C810",
            "x-amz-id-2":"FMyUVURIY8/IgAtTv8xRjskZQpcIZ9KG4V5Wp6S7S/JRWeUWerMUE5JgHvANOjpD"
         },
         "s3":{
            "s3SchemaVersion":"1.0",
            "configurationId":"testConfigRule",
            "bucket":{
               "name":"mybucket",
               "ownerIdentity":{
                  "principalId":"A3NL1KOZZKExample"
               },
               "arn":"arn:aws:s3:::mybucket"
            },
            "object":{
               "key":"HappyFace.jpg",
               "size":1024,
               "eTag":"d41d8cd98f00b204e9800998ecf8427e",
               "versionId":"096fKKXTRTtl3on89fVO.nfljtsv6qko",
               "sequencer":"0055AED6DCD90281E5"
            }
         }
      }
   ]
}

 */

