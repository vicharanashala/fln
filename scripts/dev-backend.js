const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const levelsBackend = path.resolve(root, 'backend', 'fln-backend');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const spawnOptions = { stdio: 'inherit', shell: process.platform === 'win32' };
const processes = [];
const args = new Set(process.argv.slice(2));

const startMain = !args.has('--levels-only');
const startLevels = !args.has('--main-only');
const mainPort = readPort('MAIN_API_PORT', 3000);
const levelsPort = readPort('LEVELS_API_PORT', 4000);

let isShuttingDown = false;

function readPort(envName, fallback) {
  const raw = process.env[envName];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid ${envName}="${raw}". Expected an integer between 1 and 65535.`);
  }

  return parsed;
}

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    // Sandboxed environments can report EACCES while a local dev server is
    // already bound. Treat it as unavailable so we do not start a duplicate.
    probe.once('error', (error) => ['EADDRINUSE', 'EACCES'].includes(error.code) ? resolve(true) : reject(error));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, '127.0.0.1');
  });
}

function hasPackageJson(folderPath) {
  return fs.existsSync(path.join(folderPath, 'package.json'));
}

function stopAll(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

function watch(name, child) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev-backend] ${name} exited with code ${code}. Stopping all services.`);
      stopAll();
      process.exitCode = code;
    }
  });
}

function spawnService(name, commandArgs, cwd) {
  console.log(`[dev-backend] Starting ${name}...`);
  const child = spawn(npm, commandArgs, { ...spawnOptions, cwd });
  processes.push(child);
  watch(name, child);
}

async function main() {
  if (!startMain && !startLevels) {
    throw new Error('Nothing to start. Remove conflicting flags and try again.');
  }

  if (startMain) {
    if (await isPortInUse(mainPort)) {
      console.log(`[dev-backend] Main API already running on port ${mainPort}.`);
    } else {
      spawnService('main backend', ['run', 'dev', '--workspace', '@fln/backend'], root);
    }
  }

  if (startLevels) {
    if (!hasPackageJson(levelsBackend)) {
      throw new Error(`Levels backend is missing package.json at ${levelsBackend}`);
    }

    if (await isPortInUse(levelsPort)) {
      console.log(`[dev-backend] Levels backend already running on port ${levelsPort}.`);
    } else {
      spawnService('levels backend', ['run', 'dev'], levelsBackend);
    }
  }

  if (processes.length === 0) {
    console.log('[dev-backend] No services were started (ports already in use or disabled by flags).');
  }
}

main().catch((error) => {
  console.error('Unable to start development services:', error);
  process.exitCode = 1;
});
