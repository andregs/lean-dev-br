package br.dev.lean.wanderlust.bff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.sun.net.httpserver.HttpServer;

class RestCatalogClientTest {

  private static HttpServer stub;
  private static String baseUrl;

  @BeforeAll
  static void startStub() throws IOException {
    stub = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    stub.createContext("/destinations", exchange -> {
      String body = """
          [{"id":"fernando-de-noronha-br","name":"Fernando de Noronha","country":"Brazil",\
          "description":"desc","imageUrl":"/img.jpg","latitude":-3.85,"longitude":-32.42,\
          "weather":{"temperatureC":27.4,"weatherCode":1}}]""";
      respond(exchange, 200, body);
    });
    stub.createContext("/destinations/fernando-de-noronha-br", exchange -> {
      String body = """
          {"id":"fernando-de-noronha-br","name":"Fernando de Noronha","country":"Brazil",\
          "description":"desc","imageUrl":"/img.jpg","latitude":-3.85,"longitude":-32.42,\
          "weather":{"temperatureC":27.4,"weatherCode":1}}""";
      respond(exchange, 200, body);
    });
    stub.createContext("/destinations/does-not-exist", exchange -> respond(exchange, 404,
        """
        {"type":"about:blank","title":"Not Found","status":404,"detail":"No destination with id does-not-exist"}"""));
    stub.start();
    baseUrl = "http://localhost:" + stub.getAddress().getPort();
  }

  @AfterAll
  static void stopStub() {
    stub.stop(0);
  }

  private static void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body)
      throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length);
    try (var os = exchange.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static RestCatalogClient client(String baseUrl) {
    var properties = new BffProperties(
        new BffProperties.Catalog(baseUrl, Duration.ofSeconds(2), Duration.ofSeconds(4)));
    return new RestCatalogClient(properties);
  }

  @Test
  void list_parsesUpstreamResponse() {
    List<Destination> result = client(baseUrl).list();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo("fernando-de-noronha-br");
    assertThat(result.get(0).weather().temperatureC()).isEqualTo(27.4);
  }

  @Test
  void find_knownId_returnsDestination() {
    Optional<Destination> result = client(baseUrl).find("fernando-de-noronha-br");

    assertThat(result).isPresent();
    assertThat(result.get().name()).isEqualTo("Fernando de Noronha");
  }

  @Test
  void find_unknownId_returnsEmpty() {
    Optional<Destination> result = client(baseUrl).find("does-not-exist");

    assertThat(result).isEmpty();
  }

  @Test
  void list_upstreamUnreachable_throwsUpstreamUnavailable() {
    RestCatalogClient unreachable = client("http://localhost:1");

    assertThatThrownBy(unreachable::list).isInstanceOf(UpstreamUnavailableException.class);
  }

  @Test
  void find_upstreamUnreachable_throwsUpstreamUnavailable() {
    RestCatalogClient unreachable = client("http://localhost:1");

    assertThatThrownBy(() -> unreachable.find("any-id"))
        .isInstanceOf(UpstreamUnavailableException.class);
  }
}
