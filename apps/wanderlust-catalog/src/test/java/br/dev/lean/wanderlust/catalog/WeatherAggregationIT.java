package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.sun.net.httpserver.HttpServer;

import dev.openfeature.sdk.Client;

/**
 * A local stub stands in for Open-Meteo (deterministic call counts, no live-API flakiness) — its
 * response shape (bare object for one coordinate, array for two-plus, both keyed by
 * {@code current.temperature_2m}/{@code current.weather_code}) was confirmed against the real API
 * before writing this, not assumed.
 */
@Testcontainers
class WeatherAggregationIT {

  @SuppressWarnings("resource") // closed by @Testcontainers extension after all tests
  @Container
  static final GenericContainer<?> VALKEY =
      new GenericContainer<>(DockerImageName.parse("valkey/valkey:8")).withExposedPorts(6379);

  private static HttpServer openMeteoStub;
  private static AtomicInteger requestCount;

  @BeforeAll
  static void startOpenMeteoStub() throws IOException {
    requestCount = new AtomicInteger();
    openMeteoStub = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    openMeteoStub.createContext("/forecast", exchange -> {
      requestCount.incrementAndGet();
      int coordCount = queryParam(exchange.getRequestURI().getQuery(), "latitude").split(",").length;
      String body = coordCount == 1 ? singleResponse() : arrayResponse(coordCount);
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, bytes.length);
      try (var os = exchange.getResponseBody()) {
        os.write(bytes);
      }
    });
    openMeteoStub.start();
  }

  @AfterAll
  static void stopOpenMeteoStub() {
    openMeteoStub.stop(0);
  }

  private WeatherClient client;
  private WeatherCache cache;
  private Client flags;

  @BeforeEach
  void setUp() {
    requestCount.set(0);
    var properties = new CatalogProperties(
        new CatalogProperties.Weather(
            "http://localhost:" + openMeteoStub.getAddress().getPort() + "/forecast",
            Duration.ofSeconds(2), Duration.ofSeconds(4), Duration.ofMinutes(15), 2),
        new CatalogProperties.Flags("unused"));

    client = new WeatherClient(properties);
    cache = new WeatherCache(redisTemplate(), properties);
    flags = mock(Client.class);
  }

  @Test
  void naive_issuesOneUpstreamCallPerCoordinate() {
    when(flags.getBooleanValue("catalog.aggregation.batched", false)).thenReturn(false);
    var service = new WeatherService(client, cache, flags);

    Map<Coord, Weather> result = service.weatherForAll(threeCoords());

    assertThat(result).hasSize(3);
    assertThat(requestCount).hasValue(3);
  }

  @Test
  void batched_allCacheMisses_issuesExactlyOneUpstreamCall() {
    when(flags.getBooleanValue("catalog.aggregation.batched", false)).thenReturn(true);
    var service = new WeatherService(client, cache, flags);

    Map<Coord, Weather> result = service.weatherForAll(threeCoords());

    assertThat(result).hasSize(3);
    assertThat(requestCount).hasValue(1);
  }

  @Test
  void batched_repeatedWithinTtl_issuesZeroUpstreamCalls() {
    when(flags.getBooleanValue("catalog.aggregation.batched", false)).thenReturn(true);
    var service = new WeatherService(client, cache, flags);

    service.weatherForAll(threeCoords());
    requestCount.set(0);
    Map<Coord, Weather> second = service.weatherForAll(threeCoords());

    assertThat(second).hasSize(3);
    assertThat(requestCount).hasValue(0);
  }

  @Test
  void batched_exactlyOneCacheMiss_stillWorks_viaTheSingleCoordinateApiShape() {
    when(flags.getBooleanValue("catalog.aggregation.batched", false)).thenReturn(true);
    var service = new WeatherService(client, cache, flags);
    List<Coord> warmedCoords = threeCoords();
    service.weatherForAll(warmedCoords); // warms the cache for all three
    requestCount.set(0);

    // Re-request the three already-cached coordinates plus one brand-new one — exactly one miss,
    // which exercises fetchBatch's single-coordinate special case (Open-Meteo returns a bare
    // object, not a 1-element array, for exactly one coordinate).
    Coord freshCoord = new Coord(10.0, 20.0);
    List<Coord> request = List.of(warmedCoords.get(0), warmedCoords.get(1), warmedCoords.get(2),
        freshCoord);

    Map<Coord, Weather> result = service.weatherForAll(request);

    assertThat(result).containsKeys(warmedCoords.get(0), warmedCoords.get(1), warmedCoords.get(2),
        freshCoord);
    assertThat(requestCount).hasValue(1);
  }

  private RedisTemplate<String, Weather> redisTemplate() {
    var connectionFactory =
        new LettuceConnectionFactory(VALKEY.getHost(), VALKEY.getMappedPort(6379));
    connectionFactory.afterPropertiesSet();
    var template = new RedisTemplate<String, Weather>();
    template.setConnectionFactory(connectionFactory);
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(new JacksonJsonRedisSerializer<>(Weather.class));
    template.afterPropertiesSet();
    return template;
  }

  private static List<Coord> threeCoords() {
    return List.of(new Coord(-3.85, -32.42), new Coord(-13.16, -72.54), new Coord(-54.8, -68.3));
  }

  private static String queryParam(String query, String name) {
    for (String pair : query.split("&")) {
      String[] kv = pair.split("=", 2);
      if (kv[0].equals(name)) {
        return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
      }
    }
    throw new IllegalArgumentException("Missing query param: " + name);
  }

  private static String singleResponse() {
    return """
        {"current":{"temperature_2m":20.0,"weather_code":1}}""";
  }

  private static String arrayResponse(int count) {
    String element = "{\"current\":{\"temperature_2m\":20.0,\"weather_code\":1}}";
    return "[" + String.join(",", Collections.nCopies(count, element)) + "]";
  }
}
