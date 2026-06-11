// @ts-check
// Hybrid Logical Clock — monotonically increasing, skew-immune timestamps.
// Format: "<wallMs_13>-<counter_5>-<nodeId_4>" — lexicographically sortable.

const NODE_ID = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

/** @param {number} n @param {number} len */
const pad = (n, len) => String(n).padStart(len, '0');

/**
 * @param {string} s
 * @returns {{ wallMs: number, counter: number, nodeId: string }}
 */
function parse(s) {
  const [w, c, n] = s.split('-');
  return { wallMs: Number(w), counter: Number(c), nodeId: n };
}

/**
 * Advance the clock. If wallMs is ahead of lastHlc, reset counter.
 * If behind or equal, keep lastHlc's wallMs and increment counter.
 * @param {string} [lastHlc]
 * @returns {string}
 */
export function hlcNow(lastHlc) {
  const wallMs = Date.now();
  if (!lastHlc) return `${pad(wallMs, 13)}-00000-${NODE_ID}`;

  const last = parse(lastHlc);
  if (wallMs > last.wallMs) return `${pad(wallMs, 13)}-00000-${NODE_ID}`;

  return `${pad(last.wallMs, 13)}-${pad(last.counter + 1, 5)}-${NODE_ID}`;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function hlcCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
