// Standalone dev entry only (`nx serve federation-catalog` in isolation) — not
// used when the shell loads this remote's ./Routes export. Real providers
// (i18n, BusProvider) come from the shell's React tree in that path.
export function App() {
  return <p>federation-catalog remote — view it through the shell at /labs/federation/catalog/</p>;
}

export default App;
