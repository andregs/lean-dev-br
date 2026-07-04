// Standalone dev entry only (`nx serve federation-cart` in isolation) — not
// used when the shell loads this remote's ./Routes export. Real providers
// (i18n, BusProvider) come from the shell's React tree in that path.
export function App() {
  return <p>federation-cart remote — view it through the shell at /labs/federation/cart/</p>;
}

export default App;
