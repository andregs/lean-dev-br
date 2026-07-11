package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;
import dev.openfeature.sdk.providers.memory.InMemoryProvider;

class FeatureFlagsConfigTest {

  @Test
  void toFlags_enabledEntry_evaluatesToItsVariant() {
    var flagsJson = new FlagsJson(Map.of(
        "catalog.aggregation.batched",
        new FlagsJson.FlagDef("ENABLED", Map.of("on", true, "off", false), "on")));

    Client client = clientFor(flagsJson);

    assertThat(client.getBooleanValue("catalog.aggregation.batched", false)).isTrue();
  }

  @Test
  void toFlags_disabledEntry_isOmitted_fallsThroughToCallerDefault() {
    var flagsJson = new FlagsJson(Map.of(
        "catalog.aggregation.batched",
        new FlagsJson.FlagDef("DISABLED", Map.of("on", true, "off", false), "on")));

    Client client = clientFor(flagsJson);

    // dev.openfeature:sdk 1.15.1's Flag has no "disabled" concept, so a DISABLED entry is
    // omitted from the map entirely — getBooleanValue falls through to the caller's default.
    assertThat(client.getBooleanValue("catalog.aggregation.batched", false)).isFalse();
    assertThat(client.getBooleanValue("catalog.aggregation.batched", true)).isTrue();
  }

  @Test
  void toFlags_unknownKey_fallsThroughToCallerDefault() {
    Client client = clientFor(new FlagsJson(Map.of()));

    assertThat(client.getBooleanValue("does-not-exist", true)).isTrue();
  }

  private static Client clientFor(FlagsJson flagsJson) {
    var provider = new InMemoryProvider(FeatureFlagsConfig.toFlags(flagsJson));
    var api = OpenFeatureAPI.getInstance();
    api.setProviderAndWait(provider);
    return api.getClient();
  }
}
