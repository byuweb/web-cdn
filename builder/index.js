"use strict";

const runner = require('./runner');
const yaml = require('node-yaml');
const path = require('path');

//Read the main config
yaml.read('./main-config.yml')
    //Now run it!
    .then(config => runner(config, {
        tmpdir: path.join(process.cwd(), '.tmp'),
        dryRun: false
    }))
    .catch(err => console.error(err));

