package br.dev.lean.wanderlust.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
  void list_looksUpWeatherInOneBulkCall() {
    when(weatherService.weatherForAll(anyList())).thenReturn(Map.of());

    service.list();

    // A single bulk lookup for all destinations, not one call per destination — proves the
    // naive-vs-batched fan-out choice lives entirely inside WeatherService, not here.
    verify(weatherService, times(1)).weatherForAll(anyList());
  }

  @Test
  void list_attachesWeatherByMatchingCoordinate() {
    Map<Coord, Weather> weatherByCoord = new HashMap<>();
    for (Destination d : catalog.all()) {
      weatherByCoord.put(new Coord(d.latitude(), d.longitude()),
          new Weather(d.latitude(), (int) d.longitude()));
    }
    when(weatherService.weatherForAll(anyList())).thenReturn(weatherByCoord);

    List<Destination> result = service.list();

    assertThat(result).allSatisfy(d -> {
      Weather expected = weatherByCoord.get(new Coord(d.latitude(), d.longitude()));
      assertThat(d.weather()).isEqualTo(expected);
    });
  }

  @Test
  void find_unknownId_returnsEmpty() {
    assertThat(service.find("does-not-exist")).isEmpty();
  }
}
