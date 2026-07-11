package br.dev.lean.wanderlust.catalog;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;
import dev.openfeature.sdk.exceptions.OpenFeatureError;
import dev.openfeature.sdk.providers.memory.Flag;
import dev.openfeature.sdk.providers.memory.InMemoryProvider;

/**
 * Reads the same flagd-schema {@code flags.json} the JS apps consume (see
 * {@code libs/flags/_adapter.js}) into an OpenFeature {@link InMemoryProvider}. No fallback if the
 * URL is unreachable — fails startup loudly rather than silently running with stale/duplicated
 * config (single source of truth is {@code apps/homepage/public/flags.json}). A flagd daemon
 * replaces the in-memory provider later with no app-code change, same seam the JS flags lib
 * documents.
 *
 * <p>
 * {@code @ImportRuntimeHints} is required under GraalVM native: {@link FlagsJson} is only ever
 * deserialized by a manual {@code RestClient} call (never a controller return/parameter type), so
 * Spring's AOT processing never discovers it and its record-accessor reflection is stripped from
 * the native image — confirmed by a native smoke run crashing with
 * {@code UnsupportedFeatureError: Record components not available for record class FlagsJson}.
 */
@Configuration
@ImportRuntimeHints(FeatureFlagsConfig.FlagsJsonRuntimeHints.class)
class FeatureFlagsConfig {

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

  private static FlagsJson fetchFlags(String flagsUrl) {
    return httpClient().get().uri(flagsUrl).retrieve().body(FlagsJson.class);
  }

  private static RestClient httpClient() {
    // HTTP_1_1 explicitly: java.net.http.HttpClient's default HTTP_2-with-upgrade-attempt
    // behavior over plaintext hangs against at least one real server we point this at locally
    // (Vite's dev server, serving flags.json for local flag-toggle testing — see
    // docs/setup/feature-flags.md) — confirmed by curl succeeding instantly against the same URL
    // while this client's request timed out and was cancelled, on both JVM and native.
    var jdkHttpClient = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(FETCH_TIMEOUT)
        .build();
    var requestFactory = new JdkClientHttpRequestFactory(jdkHttpClient);
    requestFactory.setReadTimeout(FETCH_TIMEOUT);
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  // dev.openfeature:sdk 1.15.1's Flag has no "disabled" concept — a DISABLED flagd entry is
  // simply omitted, so getBooleanValue(key, default) falls through to the caller's default,
  // same net effect as the JS adapter's explicit `disabled` flag.
  static Map<String, Flag<?>> toFlags(FlagsJson flagsJson) {
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
