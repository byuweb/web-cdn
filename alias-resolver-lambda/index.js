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

const req = require('request-promise-native');

/*
{
    "Records": [
        {
            "cf": {
                "config": {
                    "distributionId": "EDFDVBD6EXAMPLE",
                    "requestId": "MRVMF7KydIvxMWfJIglgwHQwZsbG2IhRJ07sn9AkKUFSHS9EXAMPLE=="
                },
                "request": {
                    "clientIp": "2001:0db8:85a3:0:0:8a2e:0370:7334",
                    "method": "GET",
                    "uri": "/picture.jpg",
                    "querystring": "size=large",
                    "headers": {
                        "host": [
                            {
                                "key": "Host",
                                "value": "d111111abcdef8.cloudfront.net"
                            }
                        ],
                        "user-agent": [
                            {
                                "key": "User-Agent",
                                "value": "curl/7.51.0"
                            }
                        ]
                    }
                }
            }
        }
    ]
}
 */

const ALIAS_REGEX = /^\/(.*?)\/((?:(?:\d+\.(?:\d+|x)\.x)|latest|unstable))\//;

exports.handler = (event, context, callback) => {
    let request = event.Records[0].cf.request;

    let uri = request.uri;

    console.log('Incoming request to', uri);
    console.log('got headers', request.headers);

    let match = ALIAS_REGEX.exec(uri);

    if (!match) {
        console.log('Not an alias; passing through');
        callback(null, request);
    } else {
        console.log(`Is an alias, still passing through because we're lazy like that`);
        callback(null, request);
    }



    /*
     * Generate HTTP redirect response with 302 status code and Location header.
     */
    // const response = {
    //     status: '302',
    //     statusDescription: 'Found',
    //     headers: {
    //         location: [{
    //             key: 'Location',
    //             value: 'http://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html',
    //         }],
    //     },
    // };
    // callback(null, response);
};