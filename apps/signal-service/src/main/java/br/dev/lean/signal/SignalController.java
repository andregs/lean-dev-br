package br.dev.lean.signal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/signal")
class SignalController {

  private final MailboxService mailbox;

  SignalController(MailboxService mailbox) {
    this.mailbox = mailbox;
  }

  @PostMapping("/{room}")
  ResponseEntity<PostResponse> post(@PathVariable String room, @RequestBody JsonNode body) {
    long at = mailbox.post(room, body);
    return ResponseEntity.ok(new PostResponse(at));
  }

  @GetMapping("/{room}")
  ResponseEntity<JsonNode> poll(
      @PathVariable String room,
      @RequestParam(defaultValue = "0") long since) throws InterruptedException {
    return mailbox.poll(room, since);
  }

  record PostResponse(long at) {
  }
}
