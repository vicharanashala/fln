const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const levelsBackend = path.resolve(root, 'backend', 'fln-backend');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const spawnOptions = { stdio: 'inherit', shell: process.platform === 'win32' };
const processes = [];

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createConnection({ port, host: '127.0.0.1' });
    probe.once('connect', () => probe.destroy(resolve(true)));
    probe.once('error', (error) => {
      probe.destroy();
      if (error.code === 'ECONNREFUSED') resolve(false);
      else reject(error);
    });
  });
}

function stopAll() {
  for (const child of processes) if (!child.killed) child.kill();
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
function watch(child) {
  child.on('exit', (code) => {
  if (code && code !== 0) {
    stopAll();
    process.exitCode = code;
  }
  });
}

async function main() {
  if (await isPortInUse(3000)) {
    console.log('Main API already running on port 3000; starting only the levels backend.');
  } else {
    processes.push(spawn(npm, ['run', 'dev', '--workspace', '@fln/backend'], { ...spawnOptions, cwd: root }));
  }

  if (await isPortInUse(4000)) {
    console.log('Levels backend already running on port 4000.');
  } else {
    processes.push(spawn(npm, ['run', 'dev'], { ...spawnOptions, cwd: levelsBackend }));
  }
  processes.forEach(watch);
}

main().catch((error) => {
  console.error('Unable to start development services:', error);
  process.exitCode = 1;
});
