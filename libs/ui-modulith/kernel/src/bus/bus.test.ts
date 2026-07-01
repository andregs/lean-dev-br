import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './bus';

describe('EventBus', () => {
  it('delivers payload to registered listener', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on('cart/add', listener);

    bus.emit('cart/add', { sku: 'A', name: 'Thing', price: 9.99, qty: 1 });

    expect(listener).toHaveBeenCalledWith({ sku: 'A', name: 'Thing', price: 9.99, qty: 1 });
  });

  it('returns unsubscribe function that stops delivery', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsub = bus.on('cart/add', listener);
    unsub();

    bus.emit('cart/add', { sku: 'B', name: 'Other', price: 1, qty: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not deliver to listeners of other events', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on('cart/add', listener);

    // Emit doesn't fire unless the event matches — type system prevents wrong keys,
    // but runtime guard matters for test completeness.
    const noMatch = 'cart/remove' as 'cart/add';
    bus.emit(noMatch, { sku: 'X', name: 'X', price: 1, qty: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('replays past payloads to a listener that subscribes late', () => {
    const bus = new EventBus();
    bus.emit('cart/add', { sku: 'A', name: 'Thing', price: 9.99, qty: 1 });
    bus.emit('cart/add', { sku: 'B', name: 'Other', price: 1, qty: 2 });

    const listener = vi.fn();
    bus.on('cart/add', listener);

    expect(listener).toHaveBeenNthCalledWith(1, { sku: 'A', name: 'Thing', price: 9.99, qty: 1 });
    expect(listener).toHaveBeenNthCalledWith(2, { sku: 'B', name: 'Other', price: 1, qty: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not replay events to a listener that already unsubscribed', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsub = bus.on('cart/add', listener);
    unsub();

    bus.on('cart/add', vi.fn());
    bus.emit('cart/add', { sku: 'C', name: 'Late', price: 1, qty: 1 });

    expect(listener).not.toHaveBeenCalled();
  });
});
