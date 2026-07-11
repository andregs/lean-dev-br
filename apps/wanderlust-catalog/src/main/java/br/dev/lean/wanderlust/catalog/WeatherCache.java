package br.dev.lean.wanderlust.catalog;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
class WeatherCache {

  private static final Logger log = LoggerFactory.getLogger(WeatherCache.class);
  private static final String KEY_PREFIX = "wx:";

  private final RedisTemplate<String, Weather> redis;
  private final CatalogProperties.Weather properties;

  WeatherCache(RedisTemplate<String, Weather> redis, CatalogProperties properties) {
    this.redis = redis;
    this.properties = properties.weather();
  }

  /** Best-effort lookup — a Valkey outage degrades to an empty result, not a failure. */
  Map<Coord, Weather> getAll(List<Coord> coords) {
    try {
      List<String> keys = coords.stream().map(this::key).toList();
      List<Weather> values = redis.opsForValue().multiGet(keys);
      if (values == null) {
        return Map.of();
      }
      Map<Coord, Weather> hits = new HashMap<>();
      for (int i = 0; i < coords.size(); i++) {
        Weather weather = values.get(i);
        if (weather != null) {
          hits.put(coords.get(i), weather);
        }
      }
      return hits;
    } catch (RedisConnectionFailureException ex) {
      log.warn("Valkey unavailable, skipping cache read: {}", ex.getMessage());
      return Map.of();
    }
  }

  /** Best-effort write — a Valkey outage degrades to a no-op, not a failure. */
  void putAll(Map<Coord, Weather> values) {
    try {
      values.forEach(
          (coord, weather) -> redis.opsForValue().set(key(coord), weather, properties.cacheTtl()));
    } catch (RedisConnectionFailureException ex) {
      log.warn("Valkey unavailable, skipping cache write: {}", ex.getMessage());
    }
  }

  private String key(Coord coord) {
    return KEY_PREFIX + round(coord.latitude()) + ":" + round(coord.longitude());
  }

  private double round(double value) {
    double factor = Math.pow(10, properties.cacheCoordPrecision());
    return Math.round(value * factor) / factor;
  }
}
