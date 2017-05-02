/**
 * This script is responsible for grabbing the latest Node.js version
 * metadata and using that to update the following files.
 *
 * Makefile: contains the versions used for the default build (TODO)
 * README.md: lists the versions this project currently supports
 * releases.json: known metadata for the current releases
 * centos7-s2i-nodejs.json: metadata to for importing into openshift
 * image-streams.json: metadata to for importing into openshift
 *
 * This script is typically executed as a part of the automated build process
 * and should not be run on its own.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;

const roi = require('roi');
const semver = require('semver');
const _ = require('underscore');
const Promise = require('fidelity');

const files = [`${process.env.OS}/s2i-nodejs.json:nodejs`,
               `${process.env.OS}/image-streams.json:${process.env.OS}-s2i-nodejs`];

roi.get({ endpoint: 'https://nodejs.org/dist/index.json' })
   .then(response => findLatest(response.body))
   .then(writeFiles)
   .then(updateReadme)
   .then(updateMakefile)
   .then(pullBase)
   .catch(console.error);

function pullBase () {
  return new Promise((resolve, reject) => {
    const docker = spawn('docker',
                         ['pull', process.env.FROM_IMAGE],
                         { stdio: 'inherit' });
    docker.on('error', reject);
    docker.on('close', (code) => {
      if (code !== 0) {
        reject(`docker pull failed with ${code}`);
      } else {
        resolve('done');
      }
    })
  });
}

function updateMakefile (versions) {
  return new Promise((resolve, reject) => {
    fs.readFile('Makefile', 'utf-8', (err, data) => {
      if (err) return reject(err);
      const regex = new RegExp(/(VERSIONS=)(.*)/);
      const replacement = `$1${versions.join(' ')}`;
      fs.writeFile('Makefile', data.replace(regex, replacement, 'utf-8'),
        (err) => {
          if (err) return reject(err);
          resolve();
        });
    });
  });

}

function updateReadme (versions) {
  return new Promise((resolve, reject) => {
    fs.readFile('README.md', 'utf-8', (err, txt) => {
      if (err) return reject(err);

      // get a list of our images mapped to all of their tags
      const newVersions = _.reduce(versions.spec.tags, (result, tag) => {
        if (tag.from.name.indexOf(':') === -1) {
          const labels = result[tag.from.name] || [];
          labels.push(tag.name);
          result[tag.from.name] = labels;
        }
        return result;
      }, {});

      // format the result as a friendly string
      let versionString = '<!-- versions.start -->\n';
      _.each(_.keys(newVersions).reverse(), (ver) => {
        versionString += `* **\`${ver}\`**: (${ver}, ${newVersions[ver].join(', ')})\n`;
      });
      versionString += '<!-- versions.end -->'

      // Replace the existing version string in README.md
      const re = new RegExp(
        /<!-- versions\.start -->\s(\*.+\s)+<!-- versions\.end -->/mg);
      fs.writeFile('README.md',
        txt.replace(re, versionString), 'utf-8', (err) => {
          if (err) return reject(err);
          resolve(_.keys(newVersions));
      });
    });
  });
}

// creates an object that maps a major version to the latest
// release of that version found in `json`
function findLatest (json) {
  return _.reduce(JSON.parse(json),
    (result, release) => {
      const version = semver.clean(release.version);
      const major = semver.major(version);
      const current = result[major] || {version: "4.0.0"}; // only > 4
      if (current && semver.gte(version, current.version)) {
        result[major] = release;
      }
      return result;
    }, {});
}

function writeFiles (releases) {
  // TODO: Only do this if there are any changes
  return new Promise((resolve, reject) => {
    fs.writeFile('releases.json', JSON.stringify(releases, null, 2),
      (err) => err ? reject(err) : undefined);
    _.each(files, (f) => {
      const [file, name] = f.split(':');
      console.log('Rewriting', file, name, '...');
      const data = imageStream(releases, name);
      fs.writeFile(file, JSON.stringify(data, null, 2),
        (err) => err ? reject(err) : resolve(data));
    });
  });
}

function imageStream (releases, name) {
  const current = _.reduce(_.keys(releases), (prev, cur) => Math.max(prev, cur));

  const data = {
        kind: 'ImageStream',
        apiVersion: 'v1',
        metadata: {
          name: name,
          creationTimestamp: `${new Date().toISOString()}`
        },
        spec: {
          tags: []
        }
      };
    _.each(releases, (r) => {
      const version = semver.clean(r.version);
      const { major, minor } = majorMinor(version);

      data.spec.tags.push(dockerImageTag(version));
      data.spec.tags.push(imageStreamTag(major, version));
      data.spec.tags.push(imageStreamTag(minor, version));

      // if this node version is lts, tag it as such
      if (r.lts) {
        data.spec.tags.push(imageStreamTag('lts', version));
        data.spec.tags.push(imageStreamTag(r.lts, version));
      }

      // if this is the current/latest version of node, tag it so
      if (major === current) {
        data.spec.tags.push(imageStreamTag('current', version));
        data.spec.tags.push(imageStreamTag('latest', version));
      }
    });
    return data;
}

function dockerImageTag (version) {
  return {
    name: version,
    annotations: annotationsFor(version, version),
    from: {
            kind: 'DockerImage',
            name: `bucharestgold/${process.env.OS}-s2i-nodejs:${version}`
          }
  };
}

function imageStreamTag (name, version) {
  return {
    name: `${name}`, // force string
    annotations: annotationsFor(name, version),
    from: {
            kind: 'ImageStreamTag',
            name: version
          }
  };
}

function annotationsFor (name, version) {
  const { major, minor } = majorMinor(version);
  return {
            description: 'Build and run Node.js applications',
            iconClass: 'icon-nodejs',
            tags: `builder, node, nodejs, nodejs-${version}, nodejs-${name}`,
            supports: `nodejs:${major}, nodejs:${minor}, nodejs`,
            sampleRepo: 'https://github.com/bucharest-gold/s2i-nodejs.git'
          };
}

function majorMinor (version) {
  return {
    major: semver.major(version),
    minor: version.split('.').slice(0,2).join('.')
  };
}
