import type { EventMap } from './event-map';

type Listener<T> = (payload: T) => void;

/**
 * Replays every past payload to a listener as soon as it subscribes, then
 * delivers new ones as they're emitted. Modules are lazy-loaded on their own
 * schedule (e.g. the cart page only mounts once /cart is visited), so a plain
 * pub/sub would silently drop events emitted before a listener existed.
 */
export class EventBus {
  #buffers = new Map<keyof EventMap, unknown[]>();
  #listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let bucket = this.#listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.#listeners.set(event, bucket);
    }
    const listeners = bucket;
    listeners.add(listener as Listener<unknown>);

    for (const payload of this.#buffers.get(event) ?? []) {
      listener(payload as EventMap[K]);
    }

    return () => {
      listeners.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    let buffer = this.#buffers.get(event);
    if (!buffer) {
      buffer = [];
      this.#buffers.set(event, buffer);
    }
    buffer.push(payload);

    this.#listeners.get(event)?.forEach((l) => {
      l(payload);
    });
  }
}
