package br.dev.lean.wanderlust.catalog;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import dev.openfeature.sdk.Client;

@Service
class WeatherService {

  private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
  private static final String BATCHED_FLAG = "catalog.aggregation.batched";

  private final WeatherClient client;
  private final WeatherCache cache;
  private final Client flags;

  WeatherService(WeatherClient client, WeatherCache cache, Client flags) {
    this.client = client;
    this.cache = cache;
    this.flags = flags;
  }

  /**
   * Weather per coordinate. A coordinate that fails to resolve maps to {@code null} so
   * destinations still render without weather rather than failing the whole request.
   *
   * <p>
   * {@code catalog.aggregation.batched} off: one Open-Meteo call per coordinate — the N+1 this
   * showcase demonstrates. On: a Valkey read-through cache, then a single Open-Meteo call for
   * whatever missed the cache.
   */
  Map<Coord, Weather> weatherForAll(List<Coord> coords) {
    if (coords.isEmpty()) {
      return Map.of();
    }
    return flags.getBooleanValue(BATCHED_FLAG, false) ? batchedLookup(coords) : naiveLookup(coords);
  }

  private Map<Coord, Weather> naiveLookup(List<Coord> coords) {
    Map<Coord, Weather> result = new HashMap<>();
    for (Coord coord : coords) {
      result.put(coord, fetchOneOrNull(coord));
    }
    return result;
  }

  private Map<Coord, Weather> batchedLookup(List<Coord> coords) {
    Map<Coord, Weather> hits = new HashMap<>(cache.getAll(coords));
    List<Coord> misses = coords.stream().filter(c -> !hits.containsKey(c)).toList();
    if (misses.isEmpty()) {
      return hits;
    }
    try {
      List<Weather> fetched = client.fetchBatch(misses);
      Map<Coord, Weather> newlyFetched = new HashMap<>();
      for (int i = 0; i < misses.size(); i++) {
        newlyFetched.put(misses.get(i), fetched.get(i));
      }
      cache.putAll(newlyFetched);
      hits.putAll(newlyFetched);
    } catch (RestClientException | IllegalStateException ex) {
      log.warn("Open-Meteo batch call failed for {} coordinate(s): {}", misses.size(),
          ex.getMessage());
      misses.forEach(c -> hits.putIfAbsent(c, null));
    }
    return hits;
  }

  private Weather fetchOneOrNull(Coord coord) {
    try {
      return client.fetchOne(coord.latitude(), coord.longitude());
    } catch (RestClientException | IllegalStateException ex) {
      log.warn("Open-Meteo call failed for ({}, {}): {}", coord.latitude(), coord.longitude(),
          ex.getMessage());
      return null;
    }
  }
}
