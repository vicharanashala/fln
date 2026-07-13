import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mvpDir = join(root, 'mvp');
const modelDir = join(root, 'services', 'model');
const setupOnly = process.argv.includes('--setup-only');
const modelName = process.env.SMARTFLN_TROCR_MODEL || 'microsoft/trocr-base-handwritten';
const modelPort = process.env.SMARTFLN_MODEL_PORT || '8090';
const mvpPort = process.env.SMARTFLN_MVP_PORT || '3000';
const cacheDir = resolve(process.env.SMARTFLN_TROCR_CACHE_DIR || join(modelDir, 'models', 'cache'));
const readyMarker = join(cacheDir, `.ready-${modelName.replace(/[^a-z0-9.-]+/gi, '_')}-transformers-4.46.3`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
}

function commandWorks(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'ignore', shell: false });
  return !result.error && result.status === 0;
}

function findSystemPython() {
  if (process.env.SMARTFLN_PYTHON) {
    if (!commandWorks(process.env.SMARTFLN_PYTHON, ['--version'])) {
      throw new Error(`SMARTFLN_PYTHON is not a working Python executable: ${process.env.SMARTFLN_PYTHON}`);
    }
    return { command: process.env.SMARTFLN_PYTHON, prefix: [] };
  }
  const candidates = process.platform === 'win32'
    ? [{ command: 'py', prefix: ['-3.11'] }, { command: 'python', prefix: [] }]
    : [{ command: 'python3', prefix: [] }, { command: 'python', prefix: [] }];
  const found = candidates.find(candidate => commandWorks(candidate.command, [...candidate.prefix, '--version']));
  if (!found) throw new Error('Python 3.11 or newer is required. Install Python, then run npm run dev again.');
  return found;
}

function npmInstallMvp() {
  const tsxCli = join(mvpDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (existsSync(tsxCli)) return tsxCli;
  console.log('\n[setup] Installing MVP Node dependencies...');
  const npmCli = process.env.npm_execpath;
  if (npmCli && existsSync(npmCli)) run(process.execPath, [npmCli, 'install'], { cwd: mvpDir });
  else run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { cwd: mvpDir });
  return tsxCli;
}

function prepareModel() {
  const explicitPython = process.env.SMARTFLN_MODEL_PYTHON;
  const venvPython = process.platform === 'win32'
    ? join(modelDir, '.venv', 'Scripts', 'python.exe')
    : join(modelDir, '.venv', 'bin', 'python');
  let python = explicitPython ? resolve(explicitPython) : venvPython;

  if (!existsSync(python)) {
    const systemPython = findSystemPython();
    console.log('\n[setup] Creating the Python model environment...');
    run(systemPython.command, [...systemPython.prefix, '-m', 'venv', join(modelDir, '.venv')]);
    python = venvPython;
  }

  const imports = 'import cv2, numpy, PIL, torch, transformers; assert transformers.__version__ == "4.46.3"';
  if (!commandWorks(python, ['-c', imports])) {
    console.log('\n[setup] Installing OpenCV and Microsoft TrOCR dependencies...');
    run(python, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel']);
    run(python, ['-m', 'pip', 'install', '-e', `${modelDir}[vision,trocr]`]);
  }

  if (!existsSync(readyMarker) && process.env.SMARTFLN_SKIP_MODEL_DOWNLOAD !== 'true') {
    console.log(`\n[setup] Downloading and caching ${modelName}. This is required only once...`);
    mkdirSync(cacheDir, { recursive: true });
    run(python, ['-c', 'from app.pipeline.recognition import _load_trocr; _load_trocr(); print("TrOCR model ready")'], {
      cwd: modelDir,
      env: {
        ...process.env,
        SMARTFLN_MODEL_OCR_PROVIDER: 'trocr',
        SMARTFLN_TROCR_MODEL: modelName,
        SMARTFLN_TROCR_LOCAL_FILES_ONLY: 'false',
        SMARTFLN_TROCR_CACHE_DIR: cacheDir,
        HF_HOME: resolve(process.env.HF_HOME || join(modelDir, 'models', 'huggingface')),
        TRANSFORMERS_CACHE: cacheDir
      }
    });
    writeFileSync(readyMarker, `${new Date().toISOString()}\n`, 'utf8');
  }
  return python;
}

async function waitFor(url, label, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${label} did not become ready within 60 seconds.`);
}

function start(command, args, cwd, env) {
  return spawn(command, args, { cwd, env, stdio: 'inherit', shell: false });
}

async function main() {
  const tsxCli = npmInstallMvp();
  const modelPython = prepareModel();
  if (setupOnly) {
    console.log('\nSmartFLN setup complete. Run npm run dev to start the application.');
    return;
  }

  console.log('\n[start] Starting Microsoft TrOCR model service and SmartFLN MVP...');
  const model = start(modelPython, ['-m', 'app.main'], modelDir, {
    ...process.env,
    SMARTFLN_MODEL_HOST: '127.0.0.1',
    SMARTFLN_MODEL_PORT: modelPort,
    SMARTFLN_MODEL_OCR_PROVIDER: 'trocr',
    SMARTFLN_TROCR_MODEL: modelName,
    SMARTFLN_TROCR_LOCAL_FILES_ONLY: 'true',
    SMARTFLN_TROCR_CACHE_DIR: cacheDir,
    HF_HOME: resolve(process.env.HF_HOME || join(modelDir, 'models', 'huggingface')),
    TRANSFORMERS_CACHE: cacheDir
  });
  const mvp = start(process.execPath, [tsxCli, 'server/index.ts'], mvpDir, {
    ...process.env,
    PORT: mvpPort,
    SMARTFLN_MODEL_SERVICE_URL: `http://127.0.0.1:${modelPort}`
  });

  const children = [model, mvp];
  let stopping = false;
  const stopAll = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  process.once('SIGINT', stopAll);
  process.once('SIGTERM', stopAll);
  for (const child of children) {
    child.once('exit', code => {
      if (!stopping) {
        console.error(`\nA SmartFLN service exited unexpectedly with code ${code}.`);
        stopAll();
        process.exitCode = code || 1;
      }
    });
  }

  try {
    await Promise.all([
      waitFor(`http://127.0.0.1:${modelPort}/health`, 'Model service', model),
      waitFor(`http://127.0.0.1:${mvpPort}/`, 'MVP', mvp)
    ]);
    console.log(`\nSmartFLN is ready: http://localhost:${mvpPort}/`);
    console.log(`Model health: http://127.0.0.1:${modelPort}/health`);
    console.log('Press Ctrl+C to stop both services.\n');
  } catch (error) {
    console.error(`\n${error.message}`);
    stopAll();
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`\nSmartFLN startup failed: ${error.message}`);
  process.exitCode = 1;
});
