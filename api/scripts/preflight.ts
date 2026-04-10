/**
 * preflight — pre-deploy gate that exercises every public GET route in-process
 * via supertest, against a real (small, dedicated) Firebase project named
 * `quartinho-preflight`. The CI job that runs this script first deploys the
 * committed `firestore.indexes.json` to that project, so the only way the
 * preflight project's index set differs from the code is if the dev added a
 * composite query without updating the indexes file. In that case, real
 * Firestore returns FAILED_PRECONDITION with a console URL to create the
 * missing index — exactly the error message we want to surface in CI before
 * the deploy hook runs.
 *
 * Filters:
 *   - method == GET (POST/PUT/DELETE need fixtures, out of scope here)
 *   - no `:param` in the path (would need a real document id)
 *   - no `requireAuth` middleware (would need an ID token fixture)
 *
 * Routes that fall outside these filters are accepted as a known coverage gap.
 * If a future incident shows we need to cover them, add fixtures to a sibling
 * `preflight-extras.ts` script.
 *
 * Required env: NODE_ENV=preflight, PREFLIGHT_FIREBASE_SERVICE_ACCOUNT
 * (the firebase admin init in api/src/config/firebase.ts reads the SA JSON).
 */

import listEndpoints from 'express-list-endpoints';
import request from 'supertest';
import app from '../src/index';

interface Failure {
  path: string;
  status: number;
  body: unknown;
  capturedErrors: string[];
}

const endpoints = listEndpoints(app)
  .filter((e) => e.methods.includes('GET'))
  .filter((e) => !e.middlewares.includes('requireAuth'))
  .filter((e) => !e.path.includes(':'));

console.log(`[preflight] discovered ${endpoints.length.toString()} public GET routes:`);
for (const ep of endpoints) console.log(`  - ${ep.path}`);
console.log('');

// Per-request console.error capture. The route handlers log Firebase errors
// (which carry the index creation URL) via console.error in their catch blocks
// — this lets us surface those messages in the failure report instead of just
// the sanitized JSON body.
const realConsoleError = console.error.bind(console);
let captured: string[] = [];
console.error = (...args: unknown[]) => {
  captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  realConsoleError(...args);
};

const failures: Failure[] = [];
for (const ep of endpoints) {
  captured = [];
  process.stdout.write(`[preflight] GET ${ep.path} ... `);
  const res = await request(app).get(ep.path);
  if (res.status >= 500) {
    console.log(`FAIL (${res.status.toString()})`);
    failures.push({
      path: ep.path,
      status: res.status,
      body: res.body as unknown,
      capturedErrors: [...captured],
    });
  } else {
    console.log(`ok (${res.status.toString()})`);
  }
}

console.error = realConsoleError;

if (failures.length > 0) {
  realConsoleError('');
  realConsoleError(`[preflight] ${failures.length.toString()} route(s) failed with 5xx:`);
  for (const f of failures) {
    realConsoleError('');
    realConsoleError(`  ✗ ${f.path} -> ${f.status.toString()}`);
    realConsoleError(`    body: ${JSON.stringify(f.body)}`);
    if (f.capturedErrors.length > 0) {
      const joined = f.capturedErrors.join('\n');
      // Firestore FAILED_PRECONDITION errors carry a console URL we can surface.
      const indexUrl = /https:\/\/console\.firebase\.google\.com\/[^\s"\\]+/.exec(joined)?.[0];
      if (indexUrl) {
        realConsoleError(`    missing firestore index — create here:`);
        realConsoleError(`    ${indexUrl}`);
      }
    }
  }
  realConsoleError('');
  realConsoleError('[preflight] DEPLOY BLOCKED');
  process.exit(1);
}

console.log('');
console.log(`[preflight] OK — ${endpoints.length.toString()} route(s) green`);
process.exit(0);
