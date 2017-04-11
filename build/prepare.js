/**
 * This script is responsible for creating the target build directories
 * and Dockerfiles for each version of Node.js that is supported, as
 * defined in ../releases.json.
 *
 * Typically executed as a precursor to a build.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('underscore');
const releases = require('../releases.json');

if (process.env.VALID_OS.indexOf(process.env.OS) > 0) {
  fs.mkdir('target', (err) => {
    if (err && err.code !== 'EEXIST') return console.log(e);
    processFiles(`Dockerfile.${process.env.OS}`, releases);
    processFiles(`Dockerfile.${process.env.OS}.onbuild`, releases);
  });
}

function processFiles (file, releases) {
  fs.readFile(file, 'utf-8', (err, txt) => {
    _.each(_.keys(releases), (version) => {
      const output = transform(txt, releases[version]);
      // Try to create a directory for each version.
      const targetDir = path.join('target', releases[version].version);
      fs.mkdir(targetDir, (err) => {
        // Reject with any error other than EEXIST
        if (err && err.code !== 'EEXIST') throw(err);
        // Write the dockerfile
        const dockerFilePath = path.join(targetDir, file);
        console.log(`Writing ${dockerFilePath}`);
        fs.writeFileSync(dockerFilePath, output);
      });
    });
  });
}

function transform (txt, version) {
  const nodeVersionRE = new RegExp(/(NODE_VERSION=)(.*)(\\)/mg);
  const npmVersionRE = new RegExp(/(NPM_VERSION=)(.*)(\\)/mg);
  const v8VersionRE = new RegExp(/(V8_VERSION=)(.*)(\\)/mg);
  const nodeLtsRE = new RegExp(/(NODE_LTS=)(.*)(\\)/mg);
  let output = txt;
  output = output.replace(nodeVersionRE, `$1${version.version} $3`);
  output = output.replace(npmVersionRE, `$1${version.npm} $3`);
  output = output.replace(v8VersionRE, `$1${version.v8} $3`);
  output = output.replace(nodeLtsRE, `$1${version.lts} $3`);
  return output;
}
