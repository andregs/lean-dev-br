package br.dev.lean.signal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class MailboxServiceTest {

    private MailboxService service;
    private JsonNode offer;
    private JsonNode answer;

    @BeforeEach
    void setUp() throws Exception {
        service = new MailboxService();
        var mapper = new ObjectMapper();
        offer = mapper.readTree("{\"type\":\"offer\",\"sdp\":\"v=0\"}");
        answer = mapper.readTree("{\"type\":\"answer\",\"sdp\":\"v=0\"}");
    }

    @Test
    void post_returnsPositiveTimestamp() {
        assertThat(service.post("room-1", offer)).isPositive();
    }

    @Test
    void poll_messageAlreadyPresent_returnsImmediately() throws InterruptedException {
        service.post("room-2", offer);

        var response = service.poll("room-2", 0);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(offer);
    }

    @Test
    void poll_sinceAtOffer_returnsAnswerOnly() throws InterruptedException {
        long offerAt = service.post("room-3", offer);
        Thread.sleep(2); // ensure the answer gets a strictly greater timestamp
        service.post("room-3", answer);

        var response = service.poll("room-3", offerAt);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(answer);
    }

    @Test
    void poll_blocksUntilMessagePosted() throws Exception {
        var pollFuture = CompletableFuture.supplyAsync(() -> {
            try {
                return service.poll("room-4", 0);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });

        Thread.sleep(50); // let the poll enter waitFor and block on the Condition
        service.post("room-4", offer);

        var response = pollFuture.get(5, TimeUnit.SECONDS);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(offer);
    }
}
