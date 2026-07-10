package br.dev.lean.wanderlust.catalog;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import org.jspecify.annotations.Nullable;
import tools.jackson.databind.ObjectMapper;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;
import dev.openfeature.sdk.exceptions.OpenFeatureError;
import dev.openfeature.sdk.providers.memory.Flag;
import dev.openfeature.sdk.providers.memory.InMemoryProvider;

/**
 * Reads the same flagd-schema {@code flags.json} the JS apps consume (see
 * {@code libs/flags/_adapter.js}) into an OpenFeature {@link InMemoryProvider}. Falls back to a
 * bundled copy if the URL is unreachable (offline local dev) — kept in sync by hand, so treat it
 * as a dev convenience, not a source of truth. A flagd daemon replaces the in-memory provider
 * later with no app-code change, same seam the JS flags lib documents.
 *
 * <p>
 * {@code @ImportRuntimeHints} is required under GraalVM native: {@link FlagsJson} is only ever
 * deserialized by a manual {@code RestClient} call (never a controller return/parameter type), so
 * Spring's own AOT processing never discovers it and its record-accessor reflection is stripped
 * from the native image — confirmed by a native smoke run crashing with
 * {@code UnsupportedFeatureError: Record components not available for record class FlagsJson}.
 */
@Configuration
@ImportRuntimeHints(FeatureFlagsConfig.FlagsJsonRuntimeHints.class)
class FeatureFlagsConfig {

  private static final Logger log = LoggerFactory.getLogger(FeatureFlagsConfig.class);
  private static final Duration FETCH_TIMEOUT = Duration.ofSeconds(2);

  @Bean
  Client featureFlagsClient(CatalogProperties properties) {
    FlagsJson flagsJson = fetchFlags(properties.flags().flagsUrl());
    var provider = new InMemoryProvider(toFlags(flagsJson));
    var api = OpenFeatureAPI.getInstance();
    try {
      api.setProviderAndWait(provider);
    } catch (OpenFeatureError e) {
      throw new IllegalStateException("Failed to initialize the OpenFeature provider", e);
    }
    return api.getClient();
  }

  private FlagsJson fetchFlags(String flagsUrl) {
    try {
      return httpClient().get().uri(flagsUrl).retrieve().body(FlagsJson.class);
    } catch (RestClientException ex) {
      log.warn("Could not fetch {} ({}); falling back to the bundled flags.json", flagsUrl,
          ex.getMessage());
      return loadBundledFlags();
    }
  }

  private static RestClient httpClient() {
    var jdkHttpClient = HttpClient.newBuilder().connectTimeout(FETCH_TIMEOUT).build();
    var requestFactory = new JdkClientHttpRequestFactory(jdkHttpClient);
    requestFactory.setReadTimeout(FETCH_TIMEOUT);
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  private FlagsJson loadBundledFlags() {
    try (InputStream in = getClass().getResourceAsStream("/flags.json")) {
      return new ObjectMapper().readValue(in, FlagsJson.class);
    } catch (IOException e) {
      throw new UncheckedIOException("Bundled flags.json missing or unreadable", e);
    }
  }

  // dev.openfeature:sdk 1.15.1's Flag has no "disabled" concept — a DISABLED flagd entry is
  // simply omitted, so getBooleanValue(key, default) falls through to the caller's default,
  // same net effect as the JS adapter's explicit `disabled` flag.
  private static Map<String, Flag<?>> toFlags(FlagsJson flagsJson) {
    Map<String, Flag<?>> flags = new HashMap<>();
    flagsJson.flags().forEach((key, def) -> {
      if (!"DISABLED".equals(def.state())) {
        flags.put(key, toFlag(def));
      }
    });
    return flags;
  }

  private static Flag<?> toFlag(FlagsJson.FlagDef def) {
    Flag<Object> flag = Flag.<Object>builder()
        .variants(def.variants())
        .defaultVariant(def.defaultVariant())
        .build();
    return flag;
  }

  static class FlagsJsonRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, @Nullable ClassLoader classLoader) {
      hints.reflection().registerType(FlagsJson.class, MemberCategory.values());
      hints.reflection().registerType(FlagsJson.FlagDef.class, MemberCategory.values());
    }
  }
}
