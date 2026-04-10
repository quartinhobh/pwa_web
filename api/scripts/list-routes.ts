/**
 * list-routes — enumerates every registered Express endpoint at runtime via
 * `express-list-endpoints`, filters for routes that are safe to smoke-test
 * against production, and prints JSON to stdout.
 *
 * A route is "safe to smoke" when:
 *   - method is GET
 *   - path has no `:param`
 *   - middleware chain does NOT include `requireAuth`
 *
 * Usage: NODE_ENV=test bun run scripts/list-routes.ts
 */

import listEndpoints from 'express-list-endpoints';
import app from '../src/index';

interface SafeRoute {
  method: 'GET';
  path: string;
}

const endpoints = listEndpoints(app);

const safe: SafeRoute[] = [];
for (const ep of endpoints) {
  if (!ep.methods.includes('GET')) continue;
  if (ep.path.includes(':')) continue;
  if (ep.middlewares.includes('requireAuth')) continue;
  safe.push({ method: 'GET', path: ep.path });
}

safe.sort((a, b) => a.path.localeCompare(b.path));

process.stdout.write(JSON.stringify(safe, null, 2) + '\n');
