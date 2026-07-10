package br.dev.lean.wanderlust.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

@Service
class DestinationService {

  private final DestinationCatalog catalog;
  private final WeatherService weatherService;

  DestinationService(DestinationCatalog catalog, WeatherService weatherService) {
    this.catalog = catalog;
    this.weatherService = weatherService;
  }

  /** Fans out one weather call per destination — the N+1 this iteration showcases. */
  List<Destination> list() {
    return catalog.all().stream().map(this::withWeather).toList();
  }

  Optional<Destination> find(String id) {
    return catalog.byId(id).map(this::withWeather);
  }

  private Destination withWeather(Destination destination) {
    Weather weather = weatherService.weatherFor(destination.latitude(), destination.longitude());
    return destination.withWeather(weather);
  }
}
