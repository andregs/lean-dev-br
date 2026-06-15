package br.dev.lean.relay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class RoomControllerTest {

    private RoomStore store;
    private RoomController controller;

    @BeforeEach
    void setUp() {
        store = mock(RoomStore.class);
        controller = new RoomController(store);
    }

    @Test
    void post_delegatesToStoreAndReturns200() {
        when(store.append("room-a", "blob"))
                .thenReturn(new RoomStore.AppendResult("epoch-1", 1L));

        var response = controller.post("room-a", new RoomController.PostRequest("blob"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().epoch()).isEqualTo("epoch-1");
        assertThat(response.getBody().seq()).isEqualTo(1L);
    }

    @Test
    void get_delegatesToStoreAndReturns200() {
        when(store.fetch("room-b", 0L, "epoch-1"))
                .thenReturn(new RoomStore.FetchResult("epoch-1", 2L, List.of("blob-a", "blob-b")));

        var response = controller.get("room-b", 0L, "epoch-1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().updates()).containsExactly("blob-a", "blob-b");
        assertThat(response.getBody().cursor()).isEqualTo(2L);
    }

    @Test
    void post_overCap_propagates413() {
        when(store.append("room-c", "blob"))
                .thenThrow(new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE));

        var ex = org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> controller.post("room-c", new RoomController.PostRequest("blob")));

        assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE);
    }
}
