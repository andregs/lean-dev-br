package br.dev.lean.relay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PruneControllerTest {

  private RoomStore store;
  private PruneController controller;

  @BeforeEach
  void setUp() {
    store = mock(RoomStore.class);
    var props = mock(RelayProperties.class);
    when(props.pruneToken()).thenReturn("secret-token");
    when(props.roomTtl()).thenReturn(Duration.ofDays(30));
    controller = new PruneController(store, props);
  }

  @Test
  void prune_validToken_delegatesAndReturns200() {
    when(store.pruneOlderThan(Duration.ofDays(30))).thenReturn(3);

    var response = controller.prune("secret-token");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().count()).isEqualTo(3);
  }

  @Test
  void prune_wrongToken_returns403() {
    var response = controller.prune("wrong-token");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  void prune_missingToken_returns403() {
    var response = controller.prune(null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  void prune_blankConfiguredToken_alwaysReturns403() {
    var props = mock(RelayProperties.class);
    when(props.pruneToken()).thenReturn("");
    var safeController = new PruneController(store, props);

    assertThat(safeController.prune("secret-token").getStatusCode())
        .isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  void prune_missingConfiguredToken_throwsInsteadOfSilentlyRejecting() {
    var props = mock(RelayProperties.class);
    when(props.pruneToken()).thenReturn(null);
    var unconfiguredController = new PruneController(store, props);

    assertThatThrownBy(() -> unconfiguredController.prune("anything"))
        .isInstanceOf(NullPointerException.class);
  }
}
