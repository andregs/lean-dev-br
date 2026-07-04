import { useEffect, useReducer } from 'react';
import { useBus, type ProductSnapshot } from '@lean-dev-br/federation-kernel';

export interface CartLine {
  sku: string;
  name: string;
  price: number;
  qty: number;
}

type Action = { type: 'reset' } | { type: 'add'; payload: ProductSnapshot };

export function cartReducer(lines: CartLine[], action: Action): CartLine[] {
  if (action.type === 'reset') return [];

  const { payload: added } = action;
  const existing = lines.find((line) => line.sku === added.sku);
  if (!existing) {
    return [...lines, { sku: added.sku, name: added.name, price: added.price, qty: added.qty }];
  }
  return lines.map((line) =>
    line.sku === added.sku ? { ...line, qty: line.qty + added.qty } : line,
  );
}

export function useCartLines(): CartLine[] {
  const bus = useBus();
  const [lines, dispatch] = useReducer(cartReducer, []);

  useEffect(() => {
    // bus.on replays every past cart/add event synchronously on subscribe. Resetting
    // first makes this idempotent if the effect re-subscribes (e.g. Strict Mode's
    // mount→cleanup→remount) — otherwise the replay would double-count. Here the
    // "past" events may have come from an entirely different remote (catalog), so
    // this is also where the federation boundary gets crossed for the first time.
    dispatch({ type: 'reset' });
    return bus.on('cart/add', (payload) => {
      dispatch({ type: 'add', payload });
    });
  }, [bus]);

  return lines;
}
