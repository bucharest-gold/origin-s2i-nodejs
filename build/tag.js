/**
 * This script is responsible for tagging built base images with Node.js
 * major version numbers.
 */
'use strict';
const querystring = require('querystring');
const path = require('path');
const http = require('http');
const fs = require('fs');
const semver = require('semver');
const _ = require('underscore');

const releases = require('../releases.json');
const versions = _.keys(releases);
const current = String(_.reduce(versions,
                   (prev, cur) => Math.max(prev, cur), 0));

const baseImages = [
  `${process.env.NAMESPACE}/${process.env.OS}-${process.env.ONBUILD_IMAGE_NAME}`,
  `${process.env.NAMESPACE}/${process.env.OS}-${process.env.BASE_IMAGE_NAME}`,
  `${process.env.NAMESPACE}/${process.env.OS}-${process.env.BASE_IMAGE_NAME}-candidate`
  ];


tagImages();

function tagImages () {
  const options = {
    socketPath: '/var/run/docker.sock',
    path: '/images/json',
    method: 'GET'
  }

  const request = http.request(options, (response) => {
    let body = '';
    response.on('data', (data) => {
      body += data.toString();
    });
    response.on('end', () => processImageData(JSON.parse(body.toString())));
  });
  request.on('error', console.error);
  request.end();
}

function tagImage (id, repo, tag) {
  const options = {
    socketPath: '/var/run/docker.sock',
    path: `/images/${id}/tag?${querystring.stringify({ repo, tag })}`,
    method: 'POST'
  }
  console.log(`Tagging ${repo}:${tag}`);
  const req = http.request(options, (response) => {
    if (response.statusCode !== 201)
      console.error(response.statusCode, response.statusMessage);
  });
  req.end();
}

function processImageData (data) {
  const largestVersionNumbersLts = new Set();
  _.each(baseImages, (image) => {
    _.each(versions, (version) => {
      if (releases[version].lts) {
        largestVersionNumbersLts.add(version);
      }
    });
    _.each(versions, (version) => {
      const fullVersionNumber = semver.clean(releases[version].version);
      const tag = `${image}:${fullVersionNumber}`;
      const imageData = _.find(data,
        (repo) => _.contains(repo.RepoTags, tag));
      if (imageData) {
        tagImage(imageData.Id.split(':')[1], image, version);
        if (releases[version].lts) {
          if (version === Array.from(largestVersionNumbersLts).pop()) {
            tagImage(imageData.Id.split(':')[1], image, 'lts');
          }
          tagImage(imageData.Id.split(':')[1], image, releases[version].lts);
        }
        if (version === current) {
          tagImage(imageData.Id.split(':')[1], image, 'latest');
        }
      } else {
        console.log(`Image ${tag} does not exist. Skipping...`);
      }
    });
  });
}
