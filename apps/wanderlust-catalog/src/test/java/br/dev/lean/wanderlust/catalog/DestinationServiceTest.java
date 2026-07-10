package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DestinationServiceTest {

  private DestinationCatalog catalog;
  private WeatherService weatherService;
  private DestinationService service;

  @BeforeEach
  void setUp() {
    catalog = new DestinationCatalog();
    weatherService = mock(WeatherService.class);
    service = new DestinationService(catalog, weatherService);
  }

  @Test
  void list_callsWeatherServiceOncePerDestination() {
    when(weatherService.weatherFor(anyDouble(), anyDouble())).thenReturn(new Weather(20.0, 1));

    List<Destination> result = service.list();

    assertThat(result).hasSize(catalog.all().size());
    // The naive N+1 path: one weather call per destination, not one batched call.
    verify(weatherService, times(catalog.all().size())).weatherFor(anyDouble(), anyDouble());
  }

  @Test
  void list_attachesWeatherToEachDestination() {
    Weather weather = new Weather(27.4, 1);
    when(weatherService.weatherFor(anyDouble(), anyDouble())).thenReturn(weather);

    List<Destination> result = service.list();

    assertThat(result).allSatisfy(d -> assertThat(d.weather()).isEqualTo(weather));
  }

  @Test
  void find_unknownId_returnsEmpty() {
    assertThat(service.find("does-not-exist")).isEmpty();
  }
}
