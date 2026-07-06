package br.dev.lean.relay;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PruneController {

  private static final Logger log = LoggerFactory.getLogger(PruneController.class);

  private final RoomStore store;
  private final RelayProperties props;

  PruneController(RoomStore store, RelayProperties props) {
    this.store = store;
    this.props = props;
  }

  record PruneResult(int count) {}

  @PostMapping("/internal/prune")
  ResponseEntity<PruneResult> prune(
      @RequestHeader(value = "X-Prune-Token", required = false) String token) {
    // No default for pruneToken — missing config NPEs here instead of
    // silently always returning 403.
    if (!MessageDigest.isEqual(
        props.pruneToken().getBytes(StandardCharsets.UTF_8),
        (token == null ? "" : token).getBytes(StandardCharsets.UTF_8))) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    int count = store.pruneOlderThan(props.roomTtl());
    log.info("PRUNE count={}", count);
    return ResponseEntity.ok(new PruneResult(count));
  }
}
