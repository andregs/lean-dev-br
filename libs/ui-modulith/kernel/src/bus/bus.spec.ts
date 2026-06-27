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
});
