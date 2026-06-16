package br.dev.lean.relay;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * In-memory {@link RoomStore} used for local dev and tests ({@code !prod}
 * profile).
 *
 * <h2>Co-presence sync model</h2>
 * Rooms are evicted only when {@link #pruneOlderThan} is invoked (by
 * {@code PruneController}, using {@code relay.room-ttl} as the age). Peers
 * must be online together to exchange updates — there is no durable handoff.
 * Because each device persists its full Yjs document in IndexedDB
 * (y-indexeddb), no data is ever lost; everything merges automatically the
 * next time both devices are online.
 *
 * <h2>Virtual threads</h2>
 * {@code spring.threads.virtual.enabled=true} makes the per-room
 * {@link java.util.concurrent.locks.ReentrantLock} cheap under concurrent
 * requests without blocking OS threads.
 */
@Service
@Profile("!prod")
class InMemoryRoomStore implements RoomStore {

  private final int maxUpdatesPerRoom;
  private final ConcurrentHashMap<String, RoomState> rooms = new ConcurrentHashMap<>();

  InMemoryRoomStore(RelayProperties props) {
    this.maxUpdatesPerRoom = props.maxUpdatesPerRoom();
  }

  @Override
  public AppendResult append(String roomId, String update) {
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

  @Override
  public FetchResult fetch(String roomId, long since, String clientEpoch) {
    var room = rooms.computeIfAbsent(roomId, id -> new RoomState());
    room.lock.lock();
    try {
      room.lastUsed = System.currentTimeMillis();
      long effectiveSince = room.epoch.equals(clientEpoch) ? since : 0;
      var slice = List.copyOf(room.updates.subList((int) effectiveSince, room.updates.size()));
      return new FetchResult(room.epoch, room.updates.size(), slice);
    } finally {
      room.lock.unlock();
    }
  }

  @Override
  public CompactResult compact(String roomId, String blob, String baseEpoch) {
    var room = rooms.get(roomId);
    if (room == null)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Epoch mismatch");
    room.lock.lock();
    try {
      if (!room.epoch.equals(baseEpoch)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Epoch mismatch");
      }
      room.updates.clear();
      room.updates.add(blob);
      room.epoch = UUID.randomUUID().toString();
      room.lastUsed = System.currentTimeMillis();
      return new CompactResult(room.epoch, 1L);
    } finally {
      room.lock.unlock();
    }
  }

  @Override
  public int pruneOlderThan(Duration age) {
    long cutoff = System.currentTimeMillis() - age.toMillis();
    var count = new AtomicInteger(0);
    rooms.entrySet().removeIf(e -> {
      if (e.getValue().isIdle(cutoff)) {
        count.incrementAndGet();
        return true;
      }
      return false;
    });
    return count.get();
  }

  private static class RoomState {
    String epoch = UUID.randomUUID().toString();
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
