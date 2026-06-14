package br.dev.lean.relay;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/rooms")
class RoomController {

  private static final Logger log = LoggerFactory.getLogger(RoomController.class);

  private final UpdateStore store;

  RoomController(UpdateStore store) {
    this.store = store;
  }

  record PostRequest(String update) {}

  @PostMapping("/{room}/updates")
  ResponseEntity<UpdateStore.AppendResult> post(
      @PathVariable String room,
      @RequestBody PostRequest body) {
    var result = store.append(room, body.update());
    log.debug("POST room={} seq={}", abbrev(room), result.seq());
    return ResponseEntity.ok(result);
  }

  @GetMapping("/{room}/updates")
  ResponseEntity<UpdateStore.FetchResult> get(
      @PathVariable String room,
      @RequestParam(defaultValue = "0") long since,
      @RequestParam(required = false) String epoch) {
    var result = store.fetch(room, since, epoch);
    log.debug("GET  room={} since={} epoch={} → {} update(s)", abbrev(room), since,
        epoch == null ? "none" : abbrev(epoch), result.updates().size());
    return ResponseEntity.ok(result);
  }

  private static String abbrev(String roomId) {
    return roomId.length() > 8 ? roomId.substring(0, 8) + "…" : roomId;
  }
}
