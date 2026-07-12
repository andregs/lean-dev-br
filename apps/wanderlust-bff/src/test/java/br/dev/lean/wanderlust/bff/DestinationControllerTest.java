package br.dev.lean.wanderlust.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class DestinationControllerTest {

  private CatalogClient catalog;
  private DestinationController controller;

  @BeforeEach
  void setUp() {
    catalog = mock(CatalogClient.class);
    controller = new DestinationController(catalog);
  }

  @Test
  void list_delegatesToCatalogClient() {
    Destination fernando = new Destination("fernando-de-noronha-br", "Fernando de Noronha",
        "Brazil", "desc", "/img.jpg", -3.85, -32.42, new Weather(27.4, 1));
    when(catalog.list()).thenReturn(List.of(fernando));

    assertThat(controller.list()).containsExactly(fernando);
  }

  @Test
  void get_unknownId_throwsNotFound() {
    when(catalog.find("nope")).thenReturn(Optional.empty());

    var ex = assertThrows(DestinationNotFoundException.class, () -> controller.get("nope"));

    var problem = controller.handleNotFound(ex);
    assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
    assertThat(problem.getDetail()).contains("nope");
  }

  @Test
  void get_upstreamUnavailable_mapsToBadGateway() {
    var ex = new UpstreamUnavailableException("catalog unreachable", new RuntimeException());

    var problem = controller.handleUpstreamUnavailable(ex);

    assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY.value());
  }
}
