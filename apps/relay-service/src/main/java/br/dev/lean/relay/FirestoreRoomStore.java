package br.dev.lean.relay;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * {@link RoomStore} backed by Cloud Firestore via its REST API.
 *
 * <p>
 * Used in the {@code prod} profile. Auth via GCP metadata-server access
 * token (cached until near expiry). No Firestore SDK dependency — REST keeps
 * the GraalVM native image clean.
 *
 * <p>
 * Atomicity: append uses Firestore precondition-based optimistic locking
 * ({@code currentDocument.exists=false} for new rooms,
 * {@code currentDocument.updateTime} for existing ones) instead of
 * transactions,
 * avoiding the {@code bytes} field that the emulator's HTTP-JSON bridge cannot
 * map. Conflicts retry up to 3 times.
 *
 * <p>
 * Data model:
 *
 * <pre>
 *   rooms/{roomId}              epoch, seq, lastUsed, createdAt
 *   rooms/{roomId}/updates/{n}  blob (opaque base-64 ciphertext), seq, createdAt
 * </pre>
 */
@Service
@Profile("prod")
class FirestoreRoomStore implements RoomStore {

  private static final Logger log = LoggerFactory.getLogger(FirestoreRoomStore.class);

  private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP = new ParameterizedTypeReference<>() {
  };

  /**
   * Firestore REST base URL including /v1, e.g.
   * {@code https://firestore.googleapis.com/v1}.
   */
  private final String api;
  /** {@code projects/{project}/databases/(default)/documents}. */
  private final String docRoot;
  private final int maxUpdatesPerRoom;
  /** Null when no auth is needed (emulator in tests). */
  private final TokenCache tokenCache;
  private final RestClient http = RestClient.create();

  @Autowired
  FirestoreRoomStore(
      @Value("${relay.firestore.base-url:https://firestore.googleapis.com/v1}") String baseUrl,
      @Value("${relay.firestore.project-id:}") String projectIdProp,
      RelayProperties props) {
    var metaClient = RestClient.create("http://metadata.google.internal");
    String projectId = projectIdProp.isBlank() ? fetchProjectId(metaClient) : projectIdProp;
    this.api = baseUrl;
    this.docRoot = "projects/" + projectId + "/databases/(default)/documents";
    this.maxUpdatesPerRoom = props.maxUpdatesPerRoom();
    this.tokenCache = new TokenCache(metaClient);
  }

  /** Test constructor — no auth, points at the Firestore emulator. */
  FirestoreRoomStore(String apiBase, String projectId, int maxUpdatesPerRoom) {
    this.api = apiBase;
    this.docRoot = "projects/" + projectId + "/databases/(default)/documents";
    this.maxUpdatesPerRoom = maxUpdatesPerRoom;
    this.tokenCache = null;
  }

  private static String fetchProjectId(RestClient metaClient) {
    return metaClient.get()
        .uri("/computeMetadata/v1/project/project-id")
        .header("Metadata-Flavor", "Google")
        .retrieve()
        .body(String.class);
  }

  // ── RoomStore ─────────────────────────────────────────────────────────────

  @Override
  public AppendResult append(String roomId, String update) {
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        return doAppend(roomId, update);
      } catch (ConflictException e) {
        if (attempt == 2)
          throw new ResponseStatusException(
              HttpStatus.SERVICE_UNAVAILABLE, "Concurrent write conflict after 3 attempts");
        log.debug("Concurrent conflict on room {}, retrying (attempt {})", roomId, attempt + 1);
      }
    }
    throw new IllegalStateException("unreachable");
  }

  @Override
  public FetchResult fetch(String roomId, long since, String clientEpoch) {
    var room = getDoc("rooms/" + roomId);
    if (room == null)
      return new FetchResult("", 0, List.of());

    String epoch = getString(room, "epoch");
    long seq = getLong(room, "seq");

    // Short-circuit: no new updates since last poll (saves the query read)
    if (epoch.equals(clientEpoch) && seq == since) {
      return new FetchResult(epoch, seq, List.of());
    }

    long effectiveSince = epoch.equals(clientEpoch) ? since : 0;
    var blobs = queryUpdates(roomId, effectiveSince);
    bumpLastUsedIfStale(room, roomId, epoch, seq);
    return new FetchResult(epoch, seq, blobs);
  }

  @Override
  public CompactResult compact(String roomId, String blob, String baseEpoch) {
    var room = getDoc("rooms/" + roomId);
    if (room == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Epoch mismatch");

    String currentEpoch = getString(room, "epoch");
    if (!currentEpoch.equals(baseEpoch)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Epoch mismatch");
    }

    long currentSeq = getLong(room, "seq");
    String newEpoch = UUID.randomUUID().toString();
    String now = Instant.now().toString();

    var writes = new ArrayList<Map<String, Object>>();

    // Delete all existing update docs (seq 1..currentSeq; IDs are numeric strings)
    for (long i = 1; i <= currentSeq; i++) {
      var del = new LinkedHashMap<String, Object>();
      del.put("delete", docRoot + "/rooms/" + roomId + "/updates/" + i);
      writes.add(del);
    }

    // Single compacted update at seq=1
    writes.add(Map.of("update", Map.of(
        "name", docRoot + "/rooms/" + roomId + "/updates/1",
        "fields", Map.of(
            "blob", strVal(blob),
            "seq", intVal(1),
            "createdAt", tsVal(now)))));

    // Room doc: roll epoch + reset seq
    var roomFields = new LinkedHashMap<String, Object>();
    roomFields.put("epoch", strVal(newEpoch));
    roomFields.put("seq", intVal(1));
    roomFields.put("lastUsed", tsVal(now));
    var roomWrite = new LinkedHashMap<String, Object>();
    roomWrite.put("update", Map.of(
        "name", docRoot + "/rooms/" + roomId,
        "fields", roomFields));
    roomWrite.put("currentDocument", Map.of("updateTime", room.get("updateTime")));
    roomWrite.put("updateMask", Map.of("fieldPaths", List.of("epoch", "seq", "lastUsed")));
    writes.add(roomWrite);

    try {
      commit(writes);
    } catch (ConflictException e) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Concurrent compaction");
    }
    return new CompactResult(newEpoch, 1L);
  }

  // ── Append ────────────────────────────────────────────────────────────────

  /**
   * Optimistic-lock append: read → write with precondition; retry on 409.
   * No {@code beginTransaction} call — avoids the emulator's bytes-field
   * serialization bug and saves one round-trip in production too.
   */
  private AppendResult doAppend(String roomId, String update) {
    var room = getDoc("rooms/" + roomId);

    String epoch;
    long newSeq;
    Map<String, Object> precondition;
    boolean isNew;

    if (room == null) {
      isNew = true;
      epoch = UUID.randomUUID().toString();
      newSeq = 1;
      precondition = Map.of("exists", false);
    } else {
      isNew = false;
      epoch = getString(room, "epoch");
      long current = getLong(room, "seq");
      if (current >= maxUpdatesPerRoom) {
        throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE,
            "Room update cap reached (" + maxUpdatesPerRoom + ")");
      }
      newSeq = current + 1;
      // updateTime is a top-level document metadata field, not inside `fields`
      precondition = Map.of("updateTime", room.get("updateTime"));
    }

    String now = Instant.now().toString();
    var writes = new ArrayList<Map<String, Object>>();

    // Room doc with precondition for atomic create-or-update
    var roomFields = new LinkedHashMap<String, Object>();
    if (isNew) {
      roomFields.put("epoch", strVal(epoch));
      roomFields.put("createdAt", tsVal(now));
    }
    roomFields.put("seq", intVal(newSeq));
    roomFields.put("lastUsed", tsVal(now));

    var roomWrite = new LinkedHashMap<String, Object>();
    roomWrite.put("update", Map.of(
        "name", docRoot + "/rooms/" + roomId,
        "fields", roomFields));
    roomWrite.put("currentDocument", precondition);
    if (!isNew) {
      roomWrite.put("updateMask", Map.of("fieldPaths", List.of("seq", "lastUsed")));
    }
    writes.add(roomWrite);

    // Update doc (seq used as doc ID for stable ordering without a separate index)
    writes.add(Map.of("update", Map.of(
        "name", docRoot + "/rooms/" + roomId + "/updates/" + newSeq,
        "fields", Map.of(
            "blob", strVal(update),
            "seq", intVal(newSeq),
            "createdAt", tsVal(now)))));

    commit(writes);
    return new AppendResult(epoch, newSeq);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  @SuppressWarnings("unchecked")
  private List<String> queryUpdates(String roomId, long since) {
    var query = Map.of("structuredQuery", Map.of(
        "from", List.of(Map.of("collectionId", "updates")),
        "where", Map.of("fieldFilter", Map.of(
            "field", Map.of("fieldPath", "seq"),
            "op", "GREATER_THAN",
            "value", intVal(since))),
        "orderBy", List.of(Map.of(
            "field", Map.of("fieldPath", "seq"),
            "direction", "ASCENDING"))));

    var results = postForList(api + "/" + docRoot + "/rooms/" + roomId + ":runQuery", query);
    var blobs = new ArrayList<String>();
    for (var row : results) {
      var doc = (Map<String, Object>) row.get("document");
      if (doc == null)
        continue; // end-of-stream marker
      blobs.add(getString(doc, "blob"));
    }
    return blobs;
  }

  private void bumpLastUsedIfStale(Map<String, Object> room, String roomId, String epoch, long seq) {
    var lastUsed = Instant.parse(getTimestamp(room, "lastUsed"));
    if (!lastUsed.isBefore(Instant.now().minusSeconds(3600)))
      return;

    String now = Instant.now().toString();
    var write = new LinkedHashMap<String, Object>();
    write.put("update", Map.of(
        "name", docRoot + "/rooms/" + roomId,
        "fields", Map.of("lastUsed", tsVal(now))));
    write.put("updateMask", Map.of("fieldPaths", List.of("lastUsed")));
    List<Map<String, Object>> writes = List.of(write);
    try {
      commit(writes);
    } catch (Exception e) {
      log.warn("Failed to bump lastUsed for room {}: {}", roomId, e.getMessage());
    }
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  private void commit(List<Map<String, Object>> writes) {
    try {
      postForMap(api + "/" + docRoot + ":commit", Map.of("writes", writes));
    } catch (HttpClientErrorException e) {
      if (e.getStatusCode().value() == 409)
        throw new ConflictException();
      throw e;
    }
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  @SuppressWarnings({ "unchecked" })
  private Map<String, Object> getDoc(String path) {
    try {
      var req = http.get().uri(api + "/" + docRoot + "/" + path);
      if (tokenCache != null)
        req = req.header("Authorization", "Bearer " + tokenCache.get());
      return (Map<String, Object>) req.retrieve().body(Map.class);
    } catch (HttpClientErrorException.NotFound e) {
      return null;
    }
  }

  @SuppressWarnings({ "unchecked" })
  private Map<String, Object> postForMap(String url, Object body) {
    var req = http.post().uri(url).body(body);
    if (tokenCache != null)
      req = req.header("Authorization", "Bearer " + tokenCache.get());
    return (Map<String, Object>) req.retrieve().body(Map.class);
  }

  private List<Map<String, Object>> postForList(String url, Object body) {
    var req = http.post().uri(url).body(body);
    if (tokenCache != null)
      req = req.header("Authorization", "Bearer " + tokenCache.get());
    return req.retrieve().body(LIST_MAP);
  }

  // ── Firestore value builders ──────────────────────────────────────────────

  private static Map<String, Object> strVal(String s) {
    return Map.of("stringValue", s);
  }

  private static Map<String, Object> intVal(long n) {
    return Map.of("integerValue", String.valueOf(n));
  }

  private static Map<String, Object> tsVal(String ts) {
    return Map.of("timestampValue", ts);
  }

  // ── Firestore field readers ───────────────────────────────────────────────

  @SuppressWarnings("unchecked")
  private static String getString(Map<?, ?> doc, String field) {
    var fields = (Map<String, Map<String, Object>>) doc.get("fields");
    return (String) fields.get(field).get("stringValue");
  }

  @SuppressWarnings("unchecked")
  private static long getLong(Map<?, ?> doc, String field) {
    var fields = (Map<String, Map<String, Object>>) doc.get("fields");
    return Long.parseLong((String) fields.get(field).get("integerValue"));
  }

  @SuppressWarnings("unchecked")
  private static String getTimestamp(Map<?, ?> doc, String field) {
    var fields = (Map<String, Map<String, Object>>) doc.get("fields");
    return (String) fields.get(field).get("timestampValue");
  }

  // ── Inner types ───────────────────────────────────────────────────────────

  private static class ConflictException extends RuntimeException {
  }

  private static class TokenCache {
    private final RestClient metaClient;
    private String token;
    private long expiresAt;

    TokenCache(RestClient metaClient) {
      this.metaClient = metaClient;
    }

    @SuppressWarnings({ "unchecked" })
    synchronized String get() {
      if (token != null && System.currentTimeMillis() < expiresAt - 60_000L)
        return token;
      var resp = (Map<String, Object>) metaClient.get()
          .uri("/computeMetadata/v1/instance/service-accounts/default/token")
          .header("Metadata-Flavor", "Google")
          .retrieve()
          .body(Map.class);
      token = (String) resp.get("access_token");
      int expiresIn = ((Number) resp.get("expires_in")).intValue();
      expiresAt = System.currentTimeMillis() + expiresIn * 1000L;
      return token;
    }
  }
}
