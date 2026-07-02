export interface ProductSnapshot {
  sku: string;
  name: string;
  price: number;
  qty: number;
}

/**
 * Typed contract for all cross-module bus events.
 * Payload lives here — never in a feature lib — so features only couple to the kernel.
 */
export interface EventMap {
  'cart/add': ProductSnapshot;
}
