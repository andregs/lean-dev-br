export interface ProductSnapshot {
  sku: string;
  name: string;
  price: number;
  qty: number;
}

/**
 * Typed contract for all cross-remote bus events.
 * Payload lives here — never in a remote — so remotes only couple to the kernel.
 */
export interface EventMap {
  'cart/add': ProductSnapshot;
}
