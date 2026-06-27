import type { EventMap } from './event-map';

type Listener<T> = (payload: T) => void;

export class EventBus {
  #listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let bucket = this.#listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.#listeners.set(event, bucket);
    }
    const listeners = bucket;
    listeners.add(listener as Listener<unknown>);
    return () => {
      listeners.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.#listeners.get(event)?.forEach((l) => {
      l(payload);
    });
  }
}
