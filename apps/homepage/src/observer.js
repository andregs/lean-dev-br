// @ts-check

const CSP_REPORT_URL = '/api/csp-report';

/** @type {ReportingObserver | null} */
let observer = null;

/**
 * Build a stable dedup key for a violation report.
 * @param {string | undefined} type
 * @param {ReportBody | null | undefined} body
 * @returns {string}
 */
export function violationKey(type, body) {
  // effectiveDirective / blockedURL live on CSPViolationReportBody, which this
  // TS lib doesn't model; read them through a loose view.
  const b = /** @type {Record<string, string | undefined>} */ (/** @type {unknown} */ (body ?? {}));
  return `${type ?? ''}|${b.effectiveDirective ?? ''}|${b.blockedURL ?? ''}`;
}

/**
 * Send a violation report via sendBeacon, deduplicating within the session.
 * Returns true if a beacon was sent, false if skipped as a duplicate.
 *
 * @param {Report} report
 * @param {Set<string>} sent - in-memory dedup for the current page lifetime
 * @returns {boolean}
 */
export function reportViolation(report, sent) {
  const key = violationKey(report.type, report.body);
  if (sent.has(key)) return false;
  sent.add(key);

  const sk = `csp:${key}`;
  try {
    if (sessionStorage.getItem(sk)) return false;
    sessionStorage.setItem(sk, '1');
  } catch {
    // sessionStorage unavailable (private mode etc.) — still send once this load
  }

  navigator.sendBeacon(
    CSP_REPORT_URL,
    JSON.stringify({ type: report.type, body: report.body, url: location.href }),
  );
  return true;
}

/**
 * Register the singleton ReportingObserver. Idempotent — repeat calls return the
 * existing instance. No-op in browsers without ReportingObserver.
 * @returns {ReportingObserver | null}
 */
export function initObserver() {
  if (typeof ReportingObserver === 'undefined') return null;
  if (observer) return observer;

  /** @type {Set<string>} */
  const sent = new Set();
  observer = new ReportingObserver(
    (reports) => {
      reports.forEach((report) => reportViolation(report, sent));
    },
    { buffered: true },
  );
  observer.observe();
  return observer;
}

/** Stop and release the observer. */
export function disconnectObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

initObserver();
