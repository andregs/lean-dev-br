package br.dev.lean.wanderlust.catalog;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * {@code @ImportRuntimeHints} is required under GraalVM native — same footgun as
 * {@code FeatureFlagsConfig}/{@code WeatherClient}: {@link Weather} is deserialized here by Spring
 * Data Redis's own Jackson usage (via {@link JacksonJsonRedisSerializer}), a separate path from
 * Spring MVC's controller-return-type serialization, so its record-accessor reflection isn't
 * auto-discovered by AOT processing.
 */
@Configuration
@ImportRuntimeHints(RedisConfig.WeatherRuntimeHints.class)
class RedisConfig {

  @Bean
  RedisTemplate<String, Weather> weatherRedisTemplate(RedisConnectionFactory connectionFactory) {
    var template = new RedisTemplate<String, Weather>();
    template.setConnectionFactory(connectionFactory);
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(new JacksonJsonRedisSerializer<>(Weather.class));
    template.afterPropertiesSet();
    return template;
  }

  static class WeatherRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, @Nullable ClassLoader classLoader) {
      hints.reflection().registerType(Weather.class, MemberCategory.values());
    }
  }
}
