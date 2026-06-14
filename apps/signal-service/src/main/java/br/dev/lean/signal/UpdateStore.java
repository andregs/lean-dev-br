package br.dev.lean.signal;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * In-memory relay for encrypted Yjs update blobs.
 *
 * <h2>Purpose</h2>
 * Clients encrypt Yjs CRDT updates (AES-GCM) on-device and POST the ciphertext
 * here; peers
 * GET to retrieve blobs they have not yet seen. The server is cryptographically
 * blind: it stores
 * and returns arbitrary base-64 strings without inspecting them. Merge logic
 * lives entirely in
 * Yjs on the client; this service is a dumb, ordered append log.
 *
 * <h2>Protocol</h2>
 * Each room has a stable {@code epoch} (random UUID) assigned when the room is
 * first created.
 * Clients embed the epoch in every GET; a mismatch means the room was evicted
 * and recreated
 * (server restart or TTL), so the client re-pushes its full Yjs state before
 * fetching.
 * Because Yjs {@code applyUpdate} is idempotent, re-applying known updates is
 * harmless.
 *
 * <h2>Seq cursor</h2>
 * Updates are numbered 1..n in insertion order; {@code seq} equals the running
 * count.
 * GET with {@code since=k} returns updates at positions k+1..n — exactly the
 * ones the caller
 * has not yet applied.
 *
 * <h2>Co-presence sync model</h2>
 * The store is intentionally transient: rooms are evicted after idling for
 * {@code roomTtlMs}
 * milliseconds. Peers must be online together to exchange updates — there is no
 * durable handoff.
 * Because each device persists its full Yjs document in IndexedDB
 * (y-indexeddb), no data is
 * ever lost; everything merges automatically the next time both devices are
 * online.
 *
 * <h2>Virtual threads</h2>
 * {@code spring.threads.virtual.enabled=true} makes the per-room
 * {@link ReentrantLock} cheap
 * under concurrent requests without blocking OS threads.
 */
@Service
class UpdateStore {

  private final int maxUpdatesPerRoom;
  private final long roomTtlMs;
  private final ConcurrentHashMap<String, RoomState> rooms = new ConcurrentHashMap<>();

  UpdateStore(RelayProperties props) {
    this.maxUpdatesPerRoom = props.maxUpdatesPerRoom();
    this.roomTtlMs = props.roomTtl().toMillis();
  }

  record AppendResult(String epoch, long seq) {
  }

  record FetchResult(String epoch, long cursor, List<String> updates) {
  }

  AppendResult append(String roomId, String update) {
    var room = rooms.computeIfAbsent(roomId, id -> new RoomState());
    room.lock.lock();
    try {
      if (room.updates.size() >= maxUpdatesPerRoom) {
        throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE,
            "Room update cap reached (" + maxUpdatesPerRoom + ")");
      }
      room.updates.add(update);
      room.lastUsed = System.currentTimeMillis();
      return new AppendResult(room.epoch, room.updates.size());
    } finally {
      room.lock.unlock();
    }
  }

  FetchResult fetch(String roomId, long since, String clientEpoch) {
    var room = rooms.computeIfAbsent(roomId, id -> new RoomState());
    room.lock.lock();
    try {
      room.lastUsed = System.currentTimeMillis();
      // Epoch mismatch (or absent) means the client's view is stale → return
      // everything.
      long effectiveSince = room.epoch.equals(clientEpoch) ? since : 0;
      var slice = List.copyOf(room.updates.subList((int) effectiveSince, room.updates.size()));
      return new FetchResult(room.epoch, room.updates.size(), slice);
    } finally {
      room.lock.unlock();
    }
  }

  @Scheduled(fixedDelay = 60, timeUnit = TimeUnit.SECONDS)
  void cleanup() {
    long cutoff = System.currentTimeMillis() - roomTtlMs;
    rooms.entrySet().removeIf(e -> e.getValue().isIdle(cutoff));
  }

  private static class RoomState {
    final String epoch = UUID.randomUUID().toString();
    final List<String> updates = new ArrayList<>();
    final ReentrantLock lock = new ReentrantLock();
    long lastUsed = System.currentTimeMillis();

    boolean isIdle(long cutoff) {
      lock.lock();
      try {
        return lastUsed < cutoff;
      } finally {
        lock.unlock();
      }
    }
  }
}
