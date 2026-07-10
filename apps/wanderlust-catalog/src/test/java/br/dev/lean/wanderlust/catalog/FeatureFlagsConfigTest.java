package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;

import dev.openfeature.sdk.Client;

class FeatureFlagsConfigTest {

  @Test
  void featureFlagsClient_fallsBackToBundledFlagsWhenUrlUnreachable() {
    var properties = new CatalogProperties(
        new CatalogProperties.Weather(
            "https://api.open-meteo.com/v1/forecast", Duration.ofSeconds(2), Duration.ofSeconds(4)),
        new CatalogProperties.Flags("http://localhost:1/flags.json"));

    Client client = new FeatureFlagsConfig().featureFlagsClient(properties);

    // Resolved from the bundled fallback (src/main/resources/flags.json), not the unreachable URL.
    assertThat(client.getBooleanValue("labs-modulith", false)).isTrue();
    // Not present in the bundled copy yet — falls through to the caller's default.
    assertThat(client.getBooleanValue("catalog.aggregation.batched", false)).isFalse();
  }
}
