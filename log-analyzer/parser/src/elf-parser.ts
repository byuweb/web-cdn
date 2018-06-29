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

import { Readable, TransformCallback } from 'stream';
import * as stringToStream from 'string-to-stream';
import split from 'split2';
import through from 'through2';
import set from 'set-value';
import UAParser from 'ua-parser-js';

export function parseElfFile(stream: Readable)
export function parseElfFile(string: string)
export function parseElfFile(streamOrString) {
    let input = typeof streamOrString === 'string' ? stringToStream(streamOrString) : streamOrString;

    return input.pipe(split()).pipe(new ElfTransform());
}

const TransformerBase = through.ctor({objectMode: true}, function (line, enc, cb) {
    (<any>this)._transformLine(line, enc, cb);
});

const fieldsDirectivePrefix = '#Fields: ';

class ElfTransform extends TransformerBase {
    _fields?: FieldDefinition<any>[];
    _queued: string[] = [];

    _transformLine(line: string, enc: string, cb: TransformCallback) {
        if (line.startsWith(fieldsDirectivePrefix)) {
            this._populateFields(line);
            this._flushQueue();
        } else if (line.startsWith('#')) {
            cb(undefined);
            return;
        } else if (!this._fields) {
            this._queued.push(line);
        } else {
            this._processLine(line)
        }

        cb(undefined);
    }

    _populateFields(line: string) {
        this._fields = line.substring(fieldsDirectivePrefix.length)
            .split(/\s+/)
            .map(fieldNameToDefn);
    }

    _flushQueue() {
        for (const line of this._queued) {
            this._processLine(line);
        }
        this._queued = [];
    }

    _processLine(line: string) {
        const defns = (<FieldDefinition<any>[]>this._fields);
        const object = line.split(/\s+/)
            .map(it => it === '-' ? undefined : it)
            .reduce((agg, value, idx) => {
                const defn = defns[idx];

                const unencoded = decodeValue(value);
                const transformed = defn.transform ? defn.transform(unencoded) : unencoded;

                set(agg, defn.path, transformed);
                return agg;
            }, {});

        this.push(object);
    }
}

function decodeValue(value: string | undefined) {
    if (value === undefined) {
        return undefined;
    }
    // Yes, we get to decode this twice. Thanks, CloudFront.
    return decodeURIComponent(decodeURIComponent(value));
}

const fieldPathsMappings = {
    'date': 'date',
    'time': 'time',
    'x-edge-location': {path: 'edgeLocation', transform: parseEdgeLocation},
    'sc-bytes': {path: 'response.size', transform: Number},
    'c-ip': 'request.ip',
    'cs-method': 'request.method',
    'cs-uri-stem': 'request.path',
    'sc-status': {path: 'response.status', transform: Number},
    'cs-uri-query': 'request.queryString',
    'x-edge-result-type': {path: 'response.type', transform: parseResultType},
    'x-edge-request-id': 'request.id',
    'x-host-header': 'request.host',
    'cs-protocol': 'request.protocol',
    'cs-bytes': {path: 'request.size', transform: Number},
    'time-taken': {path: 'duration', transform: Number},
    'x-forwarded-for': 'request.proxy',
    'ssl-protocol': 'request.ssl.protocol',
    'ssl-cipher': 'request.ssl.cipher',
    'x-edge-response-result-type': {path: 'response.initialType', transform: parseResultType},
    'cs-protocol-version': 'request.httpVersion',
    'cs(User-Agent)': {path: 'request.userAgent', transform: parseUA},
    'cs(Referer)': 'request.referrer'
};

export interface LogRow {
    date: string
    time: string
    edgeLocation: string
    duration: number

}

export interface LogRequest {

}

export interface LogResponse {

}

const headerPattern = /cs\((.+?)\)/;

function fieldNameToDefn(name: string): FieldDefinition<any> {
    const mapping = fieldPathsMappings[name];
    if (mapping) {
        if (typeof mapping === 'string') {
            return {path: mapping};
        } else {
            return {path: mapping.path, transform: mapping.transform};
        }
    }

    const headerMatch = name.match(headerPattern);
    if (headerMatch) {
        return {path: 'request.headers.' + headerMatch[1]};
    }

    return {path: 'extra.' + name};
}

interface FieldDefinition<Type> {
    path: string
    transform?: (string) => Type
}

/*

c   Client
s   Server
r   Remote
cs  Client to Server.
sc  Server to Client.
sr  Server to Remote Server, this prefix is used by proxies.
rs  Remote Server to Server, this prefix is used by proxies.
x   Application specific identifier.

The identifier cs-method thus refers to the method in the request sent by the client to the server while sc(Referer) refers to the referer: field of the reply. The identifier c-ip refers to the client's ip address.

Identifiers.
The following identifiers do not require a prefix

date    Date at which transaction completed, field has type <date>
time    Time at which transaction completed, field has type <time>
time-taken  Time taken for transaction to complete in seconds, field has type <fixed>
bytes   bytes transferred, field has type <integer>
cached  Records whether a cache hit occurred, field has type <integer> 0 indicates a cache miss.

The following identifiers require a prefix

ip      IP address and port, field has type <address>
dns     DNS name, field has type <name>
status  Status code, field has type <integer>
comment Comment returned with status code, field has type <text>
method  Method, field has type <name>
uri     URI, field has type <uri>
uri-stem    Stem portion alone of URI (omitting query), field has type <uri>
uri-query   Query portion alone of URI, field has type <uri>

 */

function parseEdgeLocation(code: string): string {
    return code;
}

function parseResultType(code: string): ResultType | undefined {
    switch (code) {
        case 'Hit': return ResultType.Hit;
        case 'RefreshHit': return ResultType.Refresh;
        case 'Miss': return ResultType.Miss;
        case 'LimitExceeded': return ResultType.LimitExceeded;
        case 'CapacityExceeded': return ResultType.CapacityExceeded;
        case 'Error': return ResultType.Error;
        case 'Redirect': return ResultType.RedirectToHttps;
        default: return undefined;
    }
}

export enum ResultType {
    Hit = 'hit',
    Refresh = 'refresh',
    Miss = 'miss',
    LimitExceeded = 'limit_exceeded',
    CapacityExceeded = 'capacity_exceeded',
    Error = 'error',
    RedirectToHttps = 'redirect_to_https',
}

function parseUA(ua: string) {
    const parsed = new UAParser(ua);

    return {
        ua: ua,
        browser: parsed.getBrowser(),
        os: parsed.getOS(),
        device: parsed.getDevice()
    }
}
