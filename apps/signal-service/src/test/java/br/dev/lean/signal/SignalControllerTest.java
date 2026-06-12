package br.dev.lean.signal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SignalControllerTest {

    private MailboxService mailbox;
    private SignalController controller;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mailbox = mock(MailboxService.class);
        controller = new SignalController(mailbox);
        mapper = new ObjectMapper();
    }

    @Test
    void post_delegatesToServiceAndReturnsTimestamp() throws Exception {
        var body = mapper.readTree("{\"type\":\"offer\"}");
        given(mailbox.post(eq("room-a"), any(JsonNode.class))).willReturn(1_000L);

        var response = controller.post("room-a", body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().at()).isEqualTo(1_000L);
    }

    @Test
    void poll_returnsServiceResponseDirectly() throws Exception {
        var body = mapper.readTree("{\"type\":\"offer\"}");
        given(mailbox.poll("room-b", 0L)).willReturn(ResponseEntity.ok(body));

        var response = controller.poll("room-b", 0L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(body);
    }

    @Test
    void poll_propagates204FromService() throws Exception {
        given(mailbox.poll("room-c", 0L)).willReturn(ResponseEntity.noContent().build());

        var response = controller.poll("room-c", 0L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
