package br.dev.lean.wanderlust.catalog;

import static com.atlassian.oai.validator.mockmvc.OpenApiValidationMatchers.openApi;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Validates actual JSON responses against {@code libs/wanderlust-contracts}' openapi.yaml — read
 * by relative path, not copied into this module. See {@code OpenApiConformanceTest} in
 * wanderlust-bff for the same enforcement on the other side of the seam.
 */
@WebMvcTest(DestinationController.class)
class OpenApiConformanceTest {

  private static final String SPEC_PATH = "../../libs/wanderlust-contracts/src/api/openapi.yaml";

  @Autowired
  private MockMvc mvc;

  @MockitoBean
  private DestinationService service;

  @Test
  void list_conformsToOpenApiSpec() throws Exception {
    when(service.list()).thenReturn(List.of(fernando()));

    mvc.perform(get("/destinations")).andExpect(openApi().isValid(SPEC_PATH));
  }

  @Test
  void get_knownId_conformsToOpenApiSpec() throws Exception {
    when(service.find("fernando-de-noronha-br")).thenReturn(Optional.of(fernando()));

    mvc.perform(get("/destinations/fernando-de-noronha-br")).andExpect(openApi().isValid(SPEC_PATH));
  }

  @Test
  void get_unknownId_problemResponseConformsToOpenApiSpec() throws Exception {
    when(service.find("nope")).thenReturn(Optional.empty());

    mvc.perform(get("/destinations/nope")).andExpect(openApi().isValid(SPEC_PATH));
  }

  private static Destination fernando() {
    return new Destination("fernando-de-noronha-br", "Fernando de Noronha", "Brazil", "desc",
        "/img.jpg", -3.85, -32.42, new Weather(27.4, 1));
  }
}
