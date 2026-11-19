// Bundles the API into one file (dist/server.mjs) so the server needs no npm install and no TypeScript runtime.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const out = fileURLToPath(new URL('../dist', import.meta.url));
mkdirSync(out, { recursive: true });

const shared = {
  bundle: true, platform: 'node', format: 'esm', target: 'node20', minify: false, sourcemap: false, legalComments: 'none',
  // Optional native add-ons of the MongoDB driver that we do not use; leaving them out keeps the bundle self-contained.
  external: ['kerberos', '@mongodb-js/zstd', 'snappy', 'mongodb-client-encryption', 'aws4', '@aws-sdk/credential-providers', 'gcp-metadata', 'socks'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
};
await build({ ...shared, entryPoints: [fileURLToPath(new URL('../src/server.ts', import.meta.url))], outfile: `${out}/server.mjs` });
await build({ ...shared, entryPoints: [fileURLToPath(new URL('./create-superadmin.ts', import.meta.url))], outfile: `${out}/create-superadmin.mjs` });
// Read by server.mjs, which starts it as a worker thread (the QR code of a photographed paper, #904).
await build({ ...shared, entryPoints: [fileURLToPath(new URL('../src/qrWorker.ts', import.meta.url))], outfile: `${out}/qrWorker.mjs` });
await build({ ...shared, entryPoints: [fileURLToPath(new URL('./import-questions.ts', import.meta.url))], outfile: `${out}/import-questions.mjs` });
copyFileSync(`${root}/data/questionBank.json`, `${out}/questionBank.json`);
copyFileSync(`${root}/data/balvatika-questions.json`, `${out}/balvatika-questions.json`);
console.log('Built apps/api/dist/server.mjs, qrWorker.mjs, create-superadmin.mjs, import-questions.mjs, questionBank.json and the Balvatika questions');
