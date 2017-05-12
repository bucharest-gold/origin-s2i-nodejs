'use strict';

const Hapi = require('hapi');
const os = require('os');
const server = new Hapi.Server();

server.connection({ port: 8080, host: '0.0.0.0' });

server.route({
  method: 'GET',
  path: '/',
  config: {
    description: 'Say hello!',
  },
  handler: (request, reply) => {
    reply('Hello Hapi!');
  }
});

server.route({
  method: 'GET',
  path: '/info',
  config: {
    description: 'Informations about the Operating system.',
  },
  handler: (request, reply) => {
    let status = `
      Server info:<br>
      Host: ${os.hostname()}<br>
      OS Type: ${os.type()}<br>
      OS Platform: ${os.platform()}<br>
      OS Arch: ${os.arch()}<br>
      OS Release: ${os.release()}<br>
      OS Uptime: ${os.uptime()}<br>
      OS Free memory: ${os.freemem() / 1024 / 1024}mb<br>
      OS Total memory: ${os.totalmem() / 1024 / 1024}mb<br>
      OS CPU count: ${os.cpus().length}<br>
      OS CPU model: ${os.cpus()[0].model}<br>
      OS CPU speed: ${os.cpus()[0].speed}mhz<br>`;
    reply(status);
  }
});

// This will enable /status and show information about 
// CPU and memory usage.
server.register({
  register: require('hapijs-status-monitor')
});

// This will print all the paths to stdout when the App starts.
server.register({ register: require('blipp')});

server.start(error => {
  if (error) {
    throw error;
  }
  console.log(`Server running at: ${server.info.uri}`);
});
