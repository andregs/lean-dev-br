package br.dev.lean.relay;

import java.util.List;

/**
 * Durable (or transient) append log for encrypted Yjs update blobs.
 *
 * <h2>Purpose</h2>
 * Clients encrypt Yjs CRDT updates (AES-GCM) on-device and POST the ciphertext
 * here; peers GET to retrieve blobs they have not yet seen. The server is
 * cryptographically blind: it stores and returns arbitrary base-64 strings
 * without inspecting them. Merge logic lives entirely in Yjs on the client;
 * this service is a dumb, ordered append log.
 *
 * <h2>Protocol</h2>
 * Each room has a stable {@code epoch} (random UUID) assigned when the room is
 * first created. Clients embed the epoch in every GET; a mismatch means the
 * room was evicted and recreated (server restart, TTL, or compaction), so the
 * client re-pushes its full Yjs state before fetching. Because Yjs
 * {@code applyUpdate} is idempotent, re-applying known updates is harmless.
 *
 * <h2>Seq cursor</h2>
 * Updates are numbered 1..n in insertion order; {@code seq} equals the running
 * count. GET with {@code since=k} returns updates at positions k+1..n —
 * exactly the ones the caller has not yet applied.
 */
interface RoomStore {

  record AppendResult(String epoch, long seq) {}

  record FetchResult(String epoch, long cursor, List<String> updates) {}

  record CompactResult(String epoch, long seq) {}

  AppendResult append(String roomId, String update);

  FetchResult fetch(String roomId, long since, String clientEpoch);

  /**
   * Replaces the room's update log with a single compacted blob and rolls the epoch.
   *
   * @param baseEpoch the epoch the client believes is current — if it doesn't match,
   *                  returns 409 (another device already compacted; client re-syncs on next fetch)
   */
  CompactResult compact(String roomId, String blob, String baseEpoch);
}
