/**
 * Created by ThatJoeMoore on 2/8/17
 */
"use strict";

const path = require('path');
const yaml = require('node-yaml');


module.exports = function() {
    return yaml.read(path.join(process.cwd(), 'main-config.yml'));
};