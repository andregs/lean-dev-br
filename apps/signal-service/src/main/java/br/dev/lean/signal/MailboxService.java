package br.dev.lean.signal;

import static java.util.concurrent.TimeUnit.MILLISECONDS;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;

/**
 * In-memory signaling mailbox for WebRTC session establishment.
 *
 * <h2>Why signaling exists</h2>
 * WebRTC peers connect directly (P2P), but before that can happen each side must exchange
 * SDP descriptors (codec/media capabilities) and ICE candidates (network paths). Neither peer
 * knows the other's address yet, so they can't talk directly — they need a neutral third party
 * to relay those two messages. That third party is this service. Once the exchange completes and
 * the data channel is open, this service is no longer involved.
 *
 * <h2>Non-trickle ICE + long-poll protocol</h2>
 * Standard WebRTC trickles ICE candidates incrementally, which would require an open connection
 * (SSE or WebSocket) for the duration of negotiation. Instead we use <em>non-trickle ICE</em>:
 * each peer gathers <em>all</em> its candidates first, then sends the complete offer or answer in
 * one shot. This reduces the exchange to exactly two HTTP messages and avoids a persistent
 * connection on the server.
 * <ol>
 *   <li>A gathers all ICE candidates, then {@code POST /signal/{room}} with the bundled offer.
 *       The response contains the server timestamp {@code at}.</li>
 *   <li>A immediately {@code GET /signal/{room}?since={at}} — long-polls waiting for the answer.</li>
 *   <li>B {@code GET /signal/{room}?since=0} — returns immediately if the offer is already there,
 *       or long-polls until it arrives.</li>
 *   <li>B gathers candidates, {@code POST /signal/{room}} with the bundled answer.
 *       This wakes A's pending GET.</li>
 *   <li>Both sides have a complete SDP — WebRTC connects. This service is done.</li>
 * </ol>
 * The {@code since} timestamp lets each peer skip its own message: A uses its offer's {@code at}
 * as the lower bound, so it only wakes on a message posted after its own.
 *
 * <h2>State and lifetime</h2>
 * Rooms are created on first use and evicted after {@value #ROOM_TTL_MS} ms of inactivity.
 * No state is persisted — the server is intentionally stateless between exchanges. This is why
 * Cloud Run is configured with {@code max-instances=1}: a second instance would have an empty
 * mailbox and the exchange would break.
 *
 * <h2>Virtual threads</h2>
 * {@code spring.threads.virtual.enabled=true} is set in application config. Each long-polling
 * GET blocks its virtual thread inside {@link RoomState#waitFor} for up to {@value #POLL_TIMEOUT_MS} ms.
 * Virtual threads make this safe: blocking costs only a few KB of heap rather than a full OS
 * thread stack, so a handful of concurrent syncs won't exhaust the Tomcat thread pool.
 */
@Service
class MailboxService {

  private static final long ROOM_TTL_MS = 5 * 60 * 1_000L;
  private static final long POLL_TIMEOUT_MS = 30_000L;

  private final ConcurrentHashMap<String, RoomState> rooms = new ConcurrentHashMap<>();

  long post(String roomId, JsonNode body) {
    return rooms.computeIfAbsent(roomId, id -> new RoomState()).add(body);
  }

  ResponseEntity<JsonNode> poll(String roomId, long since) throws InterruptedException {
    return rooms.computeIfAbsent(roomId, id -> new RoomState()).waitFor(since, POLL_TIMEOUT_MS);
  }

  @Scheduled(fixedDelay = 60_000)
  void cleanup() {
    long cutoff = System.currentTimeMillis() - ROOM_TTL_MS;
    rooms.entrySet().removeIf(e -> e.getValue().isIdle(cutoff));
  }

  /**
   * Mutable state for a single signaling room. All access is guarded by {@link #lock} so that
   * the check-then-wait in {@link #waitFor} is atomic with respect to {@link #add}: a POST that
   * arrives while a GET is evaluating the message list will always wake the waiter rather than
   * being missed.
   */
  private static class RoomState {
    private final List<SignalMessage> messages = new ArrayList<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition updated = lock.newCondition();
    private long lastUsed = System.currentTimeMillis();

    long add(JsonNode body) {
      lock.lock();
      try {
        var msg = new SignalMessage(System.currentTimeMillis(), body);
        messages.add(msg);
        lastUsed = msg.at();
        updated.signalAll();
        return msg.at();
      } finally {
        lock.unlock();
      }
    }

    ResponseEntity<JsonNode> waitFor(long since, long timeoutMs) throws InterruptedException {
      long deadline = System.currentTimeMillis() + timeoutMs;
      lock.lock();
      try {
        while (true) {
          for (var msg : messages) {
            if (msg.at() > since)
              return ResponseEntity.ok(msg.body());
          }
          long remaining = deadline - System.currentTimeMillis();
          if (remaining <= 0 || !updated.await(remaining, MILLISECONDS)) {
            return ResponseEntity.noContent().build();
          }
        }
      } finally {
        lock.unlock();
      }
    }

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
