package br.dev.lean.signal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class UpdateStoreTest {

  private UpdateStore store;

  @BeforeEach
  void setUp() {
    var props = mock(RelayProperties.class);
    when(props.roomTtl()).thenReturn(Duration.ofMillis(300_000));
    when(props.maxUpdatesPerRoom()).thenReturn(5);
    store = new UpdateStore(props);
  }

  @Test
  void append_returnsStableEpochAndMonotonicSeq() {
    var r1 = store.append("r1", "blob-a");
    var r2 = store.append("r1", "blob-b");

    assertThat(r1.epoch()).isEqualTo(r2.epoch());
    assertThat(r2.seq()).isGreaterThan(r1.seq());
  }

  @Test
  void fetch_since0_returnsAllUpdates() {
    store.append("r2", "blob-a");
    store.append("r2", "blob-b");

    var result = store.fetch("r2", 0, null);

    assertThat(result.updates()).containsExactly("blob-a", "blob-b");
    assertThat(result.cursor()).isEqualTo(2);
  }

  @Test
  void fetch_sinceCursor_returnsOnlyNewUpdates() {
    var at1 = store.append("r3", "blob-a").seq();
    store.append("r3", "blob-b");
    store.append("r3", "blob-c");

    var result = store.fetch("r3", at1, store.fetch("r3", 0, null).epoch());

    assertThat(result.updates()).containsExactly("blob-b", "blob-c");
    assertThat(result.cursor()).isEqualTo(3);
  }

  @Test
  void fetch_epochMismatch_returnsAllUpdates() {
    store.append("r4", "blob-a");
    store.append("r4", "blob-b");
    var epoch = store.fetch("r4", 0, null).epoch();

    var result = store.fetch("r4", 2, "wrong-epoch");

    assertThat(result.epoch()).isEqualTo(epoch);
    assertThat(result.updates()).containsExactly("blob-a", "blob-b");
  }

  @Test
  void fetch_epochAbsent_returnsAllUpdates() {
    store.append("r5", "blob-a");

    var result = store.fetch("r5", 1, null);

    assertThat(result.updates()).containsExactly("blob-a");
  }

  @Test
  void append_overCap_throws413() {
    for (int i = 0; i < 5; i++)
      store.append("r6", "blob-" + i);

    assertThatThrownBy(() -> store.append("r6", "overflow"))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("413");
  }

  @Test
  void fetch_emptyRoom_returnsEmptyList() {
    var result = store.fetch("r7", 0, null);

    assertThat(result.updates()).isEmpty();
    assertThat(result.cursor()).isEqualTo(0);
    assertThat(result.epoch()).isNotBlank();
  }

  @Test
  void fetch_bumpsLastUsed_roomSurvivesCleanup() throws InterruptedException {
    var props = mock(RelayProperties.class);
    when(props.roomTtl()).thenReturn(Duration.ofMillis(50));
    when(props.maxUpdatesPerRoom()).thenReturn(10);
    var shortTtlStore = new UpdateStore(props);

    shortTtlStore.append("r8", "blob");
    Thread.sleep(30);
    shortTtlStore.fetch("r8", 0, null); // bumps lastUsed
    Thread.sleep(30);
    shortTtlStore.cleanup();

    // lastUsed was refreshed by the fetch, so the room should still exist
    var result = shortTtlStore.fetch("r8", 0, null);
    assertThat(result.updates()).containsExactly("blob");
  }
}
