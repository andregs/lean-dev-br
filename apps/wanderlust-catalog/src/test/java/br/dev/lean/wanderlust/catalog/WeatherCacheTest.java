package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

class WeatherCacheTest {

  private static final Coord NORONHA = new Coord(-3.85, -32.42);

  // No Valkey listening here — proves getAll/putAll degrade gracefully instead of propagating a
  // connection failure, so a Valkey outage doesn't take the read path down with it.
  private final WeatherCache cache = new WeatherCache(unreachableRedisTemplate(),
      new CatalogProperties(
          new CatalogProperties.Weather("unused", Duration.ofSeconds(1), Duration.ofSeconds(1),
              Duration.ofMinutes(15), 2),
          new CatalogProperties.Flags("unused")));

  @Test
  void getAll_valkeyUnreachable_returnsEmptyInsteadOfThrowing() {
    Map<Coord, Weather> result = cache.getAll(List.of(NORONHA));

    assertThat(result).isEmpty();
  }

  @Test
  void putAll_valkeyUnreachable_doesNotThrow() {
    assertThatCode(() -> cache.putAll(Map.of(NORONHA, new Weather(27.4, 1)))).doesNotThrowAnyException();
  }

  private static RedisTemplate<String, Weather> unreachableRedisTemplate() {
    var connectionFactory = new LettuceConnectionFactory("localhost", 1); // nothing listens on 1
    connectionFactory.afterPropertiesSet();
    var template = new RedisTemplate<String, Weather>();
    template.setConnectionFactory(connectionFactory);
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(new JacksonJsonRedisSerializer<>(Weather.class));
    template.afterPropertiesSet();
    return template;
  }
}
