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
copyFileSync(`${root}/data/questionBank.json`, `${out}/questionBank.json`);
console.log('Built apps/api/dist/server.mjs, create-superadmin.mjs and questionBank.json');
