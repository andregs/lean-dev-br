'use client';
import { faro } from '@grafana/faro-web-sdk';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Next has no official Faro router integration — tag the current view via
// setView() on pathname change instead of the generic trackNavigation flag,
// which gives raw URLs only. No-op until Faro is actually initialized
// (faro.api is undefined while the observability-faro flag is off).
export function FaroRouteTracker() {
  const pathname = usePathname();
  const previousPathname = useRef<string>(undefined);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      // faro.api is a noop stub until initObservability runs (flag-gated,
      // async), so this is safe to call unconditionally either way.
      faro.api.setView({ name: pathname });
      previousPathname.current = pathname;
    }
  }, [pathname]);

  return null;
}
