package br.dev.lean.relay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.gcloud.FirestoreEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class FirestoreRoomStoreIT {

  @SuppressWarnings("resource") // closed by @Testcontainers extension after all tests
  @Container
  static final FirestoreEmulatorContainer EMULATOR = new FirestoreEmulatorContainer(
      DockerImageName.parse("gcr.io/google.com/cloudsdktool/cloud-sdk:emulators"))
      .waitingFor(Wait.forListeningPort().withStartupTimeout(Duration.ofMinutes(3)));

  private FirestoreRoomStore store;

  @BeforeEach
  void setUp() {
    store = new FirestoreRoomStore(
        "http://" + EMULATOR.getEmulatorEndpoint() + "/v1",
        "test-project",
        5);
  }

  @Test
  void append_createsRoomAndReturnsEpochAndSeq1() {
    var result = store.append("r1", "blob-a");

    assertThat(result.epoch()).isNotBlank();
    assertThat(result.seq()).isEqualTo(1L);
  }

  @Test
  void append_subsequentCallReturnsSameEpochAndIncrementedSeq() {
    var r1 = store.append("r2", "blob-a");
    var r2 = store.append("r2", "blob-b");

    assertThat(r2.epoch()).isEqualTo(r1.epoch());
    assertThat(r2.seq()).isEqualTo(2L);
  }

  @Test
  void fetch_since0_returnsAllUpdates() {
    store.append("r3", "blob-a");
    store.append("r3", "blob-b");
    var epoch = store.fetch("r3", 0, null).epoch();

    var result = store.fetch("r3", 0, epoch);

    assertThat(result.updates()).containsExactly("blob-a", "blob-b");
    assertThat(result.cursor()).isEqualTo(2L);
    assertThat(result.epoch()).isEqualTo(epoch);
  }

  @Test
  void fetch_sinceCursor_returnsOnlyNewUpdates() {
    var at1 = store.append("r4", "blob-a").seq();
    store.append("r4", "blob-b");
    store.append("r4", "blob-c");
    var epoch = store.fetch("r4", 0, null).epoch();

    var result = store.fetch("r4", at1, epoch);

    assertThat(result.updates()).containsExactly("blob-b", "blob-c");
    assertThat(result.cursor()).isEqualTo(3L);
  }

  @Test
  void fetch_emptySync_shortCircuitsWithoutQuery() {
    store.append("r5", "blob-a");
    var after1 = store.fetch("r5", 0, null);

    // seq==cursor and epoch matches → no updates subcollection query needed
    var result = store.fetch("r5", after1.cursor(), after1.epoch());

    assertThat(result.updates()).isEmpty();
    assertThat(result.cursor()).isEqualTo(1L);
  }

  @Test
  void fetch_epochMismatch_returnsAllUpdates() {
    store.append("r6", "blob-a");
    store.append("r6", "blob-b");
    var realEpoch = store.fetch("r6", 0, null).epoch();

    var result = store.fetch("r6", 2, "wrong-epoch");

    assertThat(result.epoch()).isEqualTo(realEpoch);
    assertThat(result.updates()).containsExactly("blob-a", "blob-b");
  }

  @Test
  void fetch_absentRoom_returnsEmpty() {
    var result = store.fetch("r7-absent", 0, null);

    assertThat(result.epoch()).isEmpty();
    assertThat(result.cursor()).isEqualTo(0L);
    assertThat(result.updates()).isEmpty();
  }

  @Test
  void append_overCap_throws413() {
    for (int i = 0; i < 5; i++)
      store.append("r8", "blob-" + i);

    assertThatThrownBy(() -> store.append("r8", "overflow"))
        .isInstanceOf(ResponseStatusException.class)
        .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
            .isEqualTo(HttpStatus.CONTENT_TOO_LARGE));
  }

  @Test
  void compact_matchingEpoch_replacesLogAndRollsEpoch() {
    store.append("r9", "blob-a");
    store.append("r9", "blob-b");
    var before = store.fetch("r9", 0, null);

    var result = store.compact("r9", "full-state", before.epoch());

    assertThat(result.epoch()).isNotEqualTo(before.epoch());
    assertThat(result.seq()).isEqualTo(1L);

    var after = store.fetch("r9", 0, result.epoch());
    assertThat(after.updates()).containsExactly("full-state");
    assertThat(after.cursor()).isEqualTo(1L);
  }

  @Test
  void compact_epochMismatch_throws409() {
    store.append("r10", "blob-a");

    assertThatThrownBy(() -> store.compact("r10", "full-state", "wrong-epoch"))
        .isInstanceOf(ResponseStatusException.class)
        .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
            .isEqualTo(HttpStatus.CONFLICT));
  }
}
