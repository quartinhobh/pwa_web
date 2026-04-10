#!/usr/bin/env node
/**
 * generate-smoke-hurl — reads routes JSON on stdin and writes a Hurl file
 * to stdout. Each route becomes a single GET request that asserts the
 * response code is < 500.
 *
 * Usage:
 *   bun run --filter=api list-routes | node scripts/generate-smoke-hurl.mjs
 *
 * The resulting Hurl file is concatenated with scripts/smoke-extras.hurl
 * (manual entries for routes that need fixtures) in the workflow.
 */

import { readFileSync } from 'node:fs';

const input = readFileSync(0, 'utf8');
const routes = JSON.parse(input);

const out = [];
out.push('# Auto-generated smoke tests — do NOT edit.');
out.push('# Source: api/scripts/list-routes.ts');
out.push('');

for (const r of routes) {
  out.push(`${r.method} {{base_url}}${r.path}`);
  out.push('HTTP *');
  out.push('[Asserts]');
  out.push('status < 500');
  out.push('');
}

process.stdout.write(out.join('\n'));
