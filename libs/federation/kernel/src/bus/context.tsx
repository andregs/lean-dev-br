import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EventBus } from './bus';

const BusContext = createContext<EventBus | null>(null);

/**
 * Mounted once, in the shell only. For a remote's useBus() to see this same
 * instance, `react` and this kernel package must both be declared as MF2
 * `shared: { singleton: true }` dependencies in every federation() config —
 * otherwise the remote gets its own React and its own (empty) BusContext.
 * Verified against a throwaway host+remote spike before this lib was built.
 */
export function BusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(() => new EventBus(), []);
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
}

export function useBus(): EventBus {
  const bus = useContext(BusContext);
  if (!bus) throw new Error('useBus must be used inside <BusProvider>');
  return bus;
}
