package br.dev.lean.wanderlust.catalog;

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

  private DestinationService service;
  private DestinationController controller;

  @BeforeEach
  void setUp() {
    service = mock(DestinationService.class);
    controller = new DestinationController(service);
  }

  @Test
  void list_delegatesToService() {
    Destination fernando = new Destination("fernando-de-noronha-br", "Fernando de Noronha",
        "Brazil", "desc", "/img.jpg", -3.85, -32.42, new Weather(27.4, 1));
    when(service.list()).thenReturn(List.of(fernando));

    assertThat(controller.list()).containsExactly(fernando);
  }

  @Test
  void get_unknownId_throwsNotFound() {
    when(service.find("nope")).thenReturn(Optional.empty());

    var ex = assertThrows(DestinationNotFoundException.class, () -> controller.get("nope"));

    var problem = controller.handleNotFound(ex);
    assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
    assertThat(problem.getDetail()).contains("nope");
  }
}
