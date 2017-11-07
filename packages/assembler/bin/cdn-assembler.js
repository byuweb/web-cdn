#!/usr/bin/env node
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

const fs = require('fs-extra');
const yaml = require('node-yaml');

const path = require('path');
const moment = require('moment');

const log = require('winston');

const args = require('yargs')
    .usage('$0 [args]')
    // .config('config', 'path to CDN config YAML file', yaml.readSync)
    .option('config', {
        alias: 'c',
        describe: 'path to CDN config YAML file'
    })
    .describe('env', 'environment')
    .alias('env', 'e')
    .choices('env', ['prod', 'stg', 'dev'])
    .option('bucket', {
        alias: 'b',
        describe: 'target bucket',
    })
    .option('cdn-host', {
        alias: 'h',
        describe: 'CDN Hosting Hostname'
    })
    .option('github-credentials', {
        describe: 'path to JSON file containing Github credentials, like {"user": "abc", "token": "def"}'
    })
    .option('github-user', {
        describe: 'GitHub user to use'
    })
    .option('github-token', {describe: 'Github access token'})
    .implies({
        'github-user': 'github-token',
        'github-token': 'github-user'
    })
    .conflicts('github-credentials', 'github-token')
    .conflicts('github-credentials', 'github-user')
    .group(['github-user', 'github-token', 'github-credentials'], 'GitHub Authentication:')

    .option('dry-run', {describe: 'Skips the upload step'})
    .option('work-dir', {
        alias: 'w',
        describe: 'Directory in which to assemble the CDN contents. Must be empty.'
    })
    .describe('verbose', 'turns on verbose logging')
    .alias('verbose', 'v')
    .boolean('verbose')
    .default('work-dir', '.tmp')
    .boolean('dry-run')
    .boolean('force-build')
    .demandOption(['config', 'bucket', 'cdn-host'], 'You must specify all of: config, bucket, and cdn-host')
    .env("CDN")
    .help()

    .check(checkArgs)
    .argv;

let start = moment();


runAssembler(args)
    .then(() => {
        console.log(`======= Finished Assembly in ${start.fromNow(true)} =======`)
    })
    .catch(err => {
        console.error('ERROR:', err);
        process.exit(1);
    });


async function runAssembler(args) {
    if (args.verbose) {
        log.level = 'debug';
    }

    let config = await loadConfig(args.config);

    const run = require('../index');
    await run(config, args.bucket, {
        dryRun: args.dryRun,
        workDir: args.workDir,
        githubCredentials: await loadGithubCredentials(args),
        env: args.env,
        cdnHost: args.cdnHost,
        forceBuild: args.forceBuild
    })
}

async function loadConfig(location) {
    return yaml.read(path.resolve(location));
}

async function loadGithubCredentials(args) {
    if (args.githubUser && args.githubToken) {
        return {
            user: args.githubUser,
            token: args.githubToken
        };
    } else if (args.githubCredentials) {
        return fs.readJson(args.githubCredentials);
    } else {
        return null;
    }
}

function checkArgs(argv, opts) {
    fs.accessSync(argv.config);

    if (argv.githubCredentials) {
        fs.accessSync(argv.githubCredentials);
    }

    if (fs.pathExistsSync(argv.workDir)) {
        let contents = fs.readdirSync(argv.workDir);
        if (contents.length) {
            console.warn(`${argv.workDir} isn't empty; contents will be overwritten!`)
        }
    }
    return true;
}


