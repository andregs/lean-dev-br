import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EventBus } from './bus';

const BusContext = createContext<EventBus | null>(null);

export function BusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(() => new EventBus(), []);
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
}

export function useBus(): EventBus {
  const bus = useContext(BusContext);
  if (!bus) throw new Error('useBus must be used inside <BusProvider>');
  return bus;
}
