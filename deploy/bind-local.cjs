// Loaded with `node --require` before Tenali starts. Tenali's own code asks to listen on every network address
// (0.0.0.0); behind nginx it should only listen on this machine (127.0.0.1). This rewrites that one request,
// so Tenali's code stays untouched and its port can never be reached from the internet around nginx.
'use strict';
const net = require('node:net');
const original = net.Server.prototype.listen;
const LOCAL = '127.0.0.1';
const OPEN = new Set(['0.0.0.0', '::', '::0', '']);

net.Server.prototype.listen = function listenLocalOnly(...args) {
  const first = args[0];
  if (typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first))) {
    // listen(port[, host][, backlog][, callback])
    if (typeof args[1] === 'string') { if (OPEN.has(args[1])) args[1] = LOCAL; }
    else args.splice(1, 0, LOCAL);
  } else if (first && typeof first === 'object' && first.path === undefined && first.fd === undefined && first.handle === undefined) {
    // listen({ port, host, ... }): a socket path or a file descriptor is left alone
    if (first.host === undefined || OPEN.has(first.host)) args[0] = { ...first, host: LOCAL };
  }
  return original.apply(this, args);
};
