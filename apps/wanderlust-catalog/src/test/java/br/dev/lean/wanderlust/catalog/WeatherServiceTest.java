package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;

class WeatherServiceTest {

  private final WeatherClient client = mock(WeatherClient.class);
  private final WeatherService service = new WeatherService(client);

  @Test
  void weatherFor_returnsClientResult() {
    Weather weather = new Weather(27.4, 1);
    when(client.fetchOne(-3.85, -32.42)).thenReturn(weather);

    assertThat(service.weatherFor(-3.85, -32.42)).isEqualTo(weather);
  }

  @Test
  void weatherFor_degradesToNullOnUpstreamFailure() {
    when(client.fetchOne(-3.85, -32.42)).thenThrow(new RestClientException("boom"));

    assertThat(service.weatherFor(-3.85, -32.42)).isNull();
  }

  @Test
  void weatherFor_degradesToNullOnMalformedResponse() {
    when(client.fetchOne(-3.85, -32.42)).thenThrow(new IllegalStateException("no current block"));

    assertThat(service.weatherFor(-3.85, -32.42)).isNull();
  }
}
