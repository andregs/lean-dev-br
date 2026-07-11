package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;

import dev.openfeature.sdk.Client;

class WeatherServiceTest {

  private static final Coord NORONHA = new Coord(-3.85, -32.42);
  private static final Coord MACHU_PICCHU = new Coord(-13.16, -72.54);
  private static final String FLAG = "catalog.aggregation.batched";

  private final WeatherClient client = mock(WeatherClient.class);
  private final WeatherCache cache = mock(WeatherCache.class);
  private final Client flags = mock(Client.class);
  private final WeatherService service = new WeatherService(client, cache, flags);

  @Test
  void weatherForAll_flagOff_callsFetchOnePerCoordinate() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(false);
    when(client.fetchOne(NORONHA.latitude(), NORONHA.longitude())).thenReturn(new Weather(27.4, 1));
    when(client.fetchOne(MACHU_PICCHU.latitude(), MACHU_PICCHU.longitude()))
        .thenReturn(new Weather(14.8, 3));

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA, MACHU_PICCHU));

    assertThat(result).containsEntry(NORONHA, new Weather(27.4, 1));
    assertThat(result).containsEntry(MACHU_PICCHU, new Weather(14.8, 3));
    verify(client, times(2)).fetchOne(anyDouble(),
        anyDouble());
    verify(cache, never()).getAll(anyList());
  }

  @Test
  void weatherForAll_flagOn_allCacheMisses_fetchesOnceAndBackfillsCache() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(true);
    when(cache.getAll(List.of(NORONHA, MACHU_PICCHU))).thenReturn(Map.of());
    when(client.fetchBatch(List.of(NORONHA, MACHU_PICCHU)))
        .thenReturn(List.of(new Weather(27.4, 1), new Weather(14.8, 3)));

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA, MACHU_PICCHU));

    assertThat(result).containsEntry(NORONHA, new Weather(27.4, 1));
    assertThat(result).containsEntry(MACHU_PICCHU, new Weather(14.8, 3));
    verify(client, times(1)).fetchBatch(List.of(NORONHA, MACHU_PICCHU));
    verify(cache, times(1)).putAll(
        Map.of(NORONHA, new Weather(27.4, 1), MACHU_PICCHU, new Weather(14.8, 3)));
  }

  @Test
  void weatherForAll_flagOn_allCacheHits_skipsUpstreamEntirely() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(true);
    Map<Coord, Weather> cached = Map.of(NORONHA, new Weather(27.4, 1), MACHU_PICCHU, new Weather(14.8, 3));
    when(cache.getAll(List.of(NORONHA, MACHU_PICCHU))).thenReturn(cached);

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA, MACHU_PICCHU));

    assertThat(result).isEqualTo(cached);
    verify(client, never()).fetchBatch(anyList());
    verify(cache, never()).putAll(anyMap());
  }

  @Test
  void weatherForAll_flagOn_partialCacheHit_fetchesOnlyTheMiss() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(true);
    when(cache.getAll(List.of(NORONHA, MACHU_PICCHU)))
        .thenReturn(Map.of(NORONHA, new Weather(27.4, 1)));
    when(client.fetchBatch(List.of(MACHU_PICCHU))).thenReturn(List.of(new Weather(14.8, 3)));

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA, MACHU_PICCHU));

    assertThat(result).containsEntry(NORONHA, new Weather(27.4, 1));
    assertThat(result).containsEntry(MACHU_PICCHU, new Weather(14.8, 3));
    verify(client, times(1)).fetchBatch(List.of(MACHU_PICCHU));
  }

  @Test
  void weatherForAll_flagOff_degradesToNullOnUpstreamFailure() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(false);
    when(client.fetchOne(NORONHA.latitude(), NORONHA.longitude()))
        .thenThrow(new RestClientException("boom"));

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA));

    assertThat(result).containsEntry(NORONHA, null);
  }

  @Test
  void weatherForAll_flagOn_degradesToNullOnBatchFailure_withoutCaching() {
    when(flags.getBooleanValue(FLAG, false)).thenReturn(true);
    when(cache.getAll(List.of(NORONHA))).thenReturn(Map.of());
    when(client.fetchBatch(List.of(NORONHA))).thenThrow(new RestClientException("boom"));

    Map<Coord, Weather> result = service.weatherForAll(List.of(NORONHA));

    assertThat(result).containsEntry(NORONHA, null);
    verify(cache, never()).putAll(anyMap());
  }

  @Test
  void weatherForAll_emptyInput_returnsEmptyWithoutTouchingCollaborators() {
    assertThat(service.weatherForAll(List.of())).isEmpty();
    verify(client, never()).fetchOne(anyDouble(),
        anyDouble());
    verify(cache, never()).getAll(anyList());
  }
}
