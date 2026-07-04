#!/usr/bin/env node
// Detect HTTP/2 or HTTP/3 stream queueing ("the federation tax") in a HAR capture.
// Chrome DevTools -> Network tab -> right-click -> "Save all as HAR with content".
//
// Usage: node analyze-har.mjs <path-to.har> [origin-substring]
//   e.g. node analyze-har.mjs ~/Downloads/shop.example.com.har example.com
// If origin-substring is omitted, the busiest origin in the capture is used.

import { readFileSync } from 'node:fs';

const harPath = process.argv[2];
if (!harPath) {
  console.error('Usage: analyze-har.mjs <path-to.har> [origin-substring]');
  process.exit(2);
}

const har = JSON.parse(readFileSync(harPath, 'utf8'));
const entries = har.log.entries.map((e) => ({
  url: e.request.url,
  host: new URL(e.request.url).host,
  protocol: e.response.httpVersion,
  conn: e._connectionId ?? 'unknown',
  start: new Date(e.startedDateTime).getTime() / 1000,
  time: e.time / 1000,
  blocked: e.timings.blocked ?? -1,
}));
entries.forEach((e) => (e.end = e.start + e.time));

const byHost = new Map();
for (const e of entries) byHost.set(e.host, (byHost.get(e.host) ?? 0) + 1);
const ranked = [...byHost.entries()].sort((a, b) => b[1] - a[1]);

console.log(`Total requests in capture: ${entries.length}\n`);
console.log('Top origins by request count:');
for (const [host, count] of ranked.slice(0, 15))
  console.log(`  ${String(count).padStart(4)}  ${host}`);

const focus = process.argv[3] ?? ranked[0][0];
const focused = entries.filter((e) => e.host.includes(focus));
if (focused.length === 0) {
  console.error(`\nNo requests matched origin substring "${focus}"`);
  process.exit(1);
}

console.log(`\n--- Focused on origin containing "${focus}" (${focused.length} requests) ---\n`);

const byProtocol = new Map();
for (const e of focused) byProtocol.set(e.protocol, (byProtocol.get(e.protocol) ?? 0) + 1);
console.log('Protocol breakdown:');
for (const [proto, count] of byProtocol) console.log(`  ${count}  ${proto || '(unknown)'}`);

const byConn = new Map();
for (const e of focused) {
  if (!byConn.has(e.conn)) byConn.set(e.conn, []);
  byConn.get(e.conn).push(e);
}
const [busiestConn, busiestReqs] = [...byConn.entries()].sort(
  (a, b) => b[1].length - a[1].length,
)[0];

let peak = 0;
for (const a of busiestReqs) {
  const concurrent = busiestReqs.filter((b) => b.start <= a.start && a.start < b.end).length;
  if (concurrent > peak) peak = concurrent;
}
console.log(
  `\nBusiest connection (id ${busiestConn}): ${busiestReqs.length} requests, peak concurrency ${peak} in-flight.`,
);
console.log(
  peak >= 100
    ? '  -> Peak concurrency is at/above documented stream-count ceilings (RFC 7540 floor 100, nginx default 128) — a hard multiplexing cap may be the cause of any stalling below.'
    : '  -> Peak concurrency is below common stream-count ceilings — stalling below is more likely browser fetch-priority scheduling, not a hard multiplexing cap.',
);

const manifestPattern = /remoteEntry|federation|mf-manifest|mf-stats|[-_]mf[-_./]/i;
const manifests = focused
  .filter((e) => manifestPattern.test(e.url))
  .sort((a, b) => b.blocked - a.blocked);

if (manifests.length > 0) {
  console.log(
    `\nFederation-looking requests (remoteEntry/mf-manifest/*-mf-* naming), by blocked time:`,
  );
  for (const e of manifests) {
    const path = new URL(e.url).pathname;
    console.log(`  ${e.blocked.toFixed(0).padStart(6)}ms blocked  ${path.slice(-70)}`);
  }
  const avgBlocked = focused.reduce((sum, e) => sum + Math.max(e.blocked, 0), 0) / focused.length;
  const avgManifestBlocked =
    manifests.reduce((sum, e) => sum + Math.max(e.blocked, 0), 0) / manifests.length;
  console.log(
    `\nAverage blocked time: ${avgBlocked.toFixed(0)}ms overall vs ${avgManifestBlocked.toFixed(0)}ms for federation-looking requests.`,
  );
} else {
  console.log(
    '\nNo remoteEntry/mf-manifest/*-mf-* naming found in this origin — nothing to flag as "federation tax".',
  );
}
