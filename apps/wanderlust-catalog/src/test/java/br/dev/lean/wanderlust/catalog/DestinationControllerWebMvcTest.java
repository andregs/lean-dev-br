package br.dev.lean.wanderlust.catalog;

import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@WebMvcTest(DestinationController.class)
class DestinationControllerWebMvcTest {

  @Autowired
  private MockMvcTester mvc;

  @MockitoBean
  private DestinationService service;

  @Test
  void list_returnsJsonArray() {
    Destination fernando = new Destination("fernando-de-noronha-br", "Fernando de Noronha",
        "Brazil", "desc", "/img.jpg", -3.85, -32.42, new Weather(27.4, 1));
    when(service.list()).thenReturn(List.of(fernando));

    mvc.get().uri("/destinations")
        .assertThat()
        .hasStatusOk()
        .hasContentType(MediaType.APPLICATION_JSON)
        .bodyJson()
        .extractingPath("$[0].id")
        .isEqualTo("fernando-de-noronha-br");
  }

  @Test
  void get_unknownId_returnsProblemJson() {
    when(service.find("nope")).thenReturn(Optional.empty());

    mvc.get().uri("/destinations/{id}", "nope")
        .assertThat()
        .hasStatus(404)
        .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
        .bodyJson()
        .extractingPath("$.status")
        .isEqualTo(404);
  }
}
