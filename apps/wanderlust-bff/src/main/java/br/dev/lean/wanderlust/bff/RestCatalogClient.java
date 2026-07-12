package br.dev.lean.wanderlust.bff;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * {@code @ImportRuntimeHints} is required under GraalVM native — same footgun as
 * wanderlust-catalog's {@code WeatherClient}/{@code FeatureFlagsConfig}: {@link Destination} is
 * also this app's controller return type (which Spring's AOT *serialization* hints cover
 * automatically), but deserializing it back out of the catalog response here is a separate
 * direction Spring's AOT processing doesn't discover on its own.
 */
@Component
@ImportRuntimeHints(RestCatalogClient.DestinationRuntimeHints.class)
class RestCatalogClient implements CatalogClient {

  private final RestClient http;

  RestCatalogClient(BffProperties properties) {
    BffProperties.Catalog catalog = properties.catalog();
    var jdkHttpClient = HttpClient.newBuilder().connectTimeout(catalog.connectTimeout()).build();
    var requestFactory = new JdkClientHttpRequestFactory(jdkHttpClient);
    requestFactory.setReadTimeout(catalog.readTimeout());
    this.http = RestClient.builder().baseUrl(catalog.baseUrl()).requestFactory(requestFactory).build();
  }

  @Override
  public List<Destination> list() {
    try {
      List<Destination> destinations = http.get()
          .uri("/destinations")
          .retrieve()
          .body(new ParameterizedTypeReference<List<Destination>>() {});
      return destinations == null ? List.of() : destinations;
    } catch (RestClientException ex) {
      throw new UpstreamUnavailableException("catalog /destinations unreachable", ex);
    }
  }

  @Override
  public Optional<Destination> find(String id) {
    try {
      Destination destination = http.get().uri("/destinations/{id}", id).retrieve().body(Destination.class);
      return Optional.ofNullable(destination);
    } catch (HttpClientErrorException.NotFound ex) {
      return Optional.empty();
    } catch (RestClientException ex) {
      throw new UpstreamUnavailableException("catalog /destinations/" + id + " unreachable", ex);
    }
  }

  static class DestinationRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, @Nullable ClassLoader classLoader) {
      hints.reflection().registerType(Destination.class, MemberCategory.values());
      hints.reflection().registerType(Weather.class, MemberCategory.values());
    }
  }
}
