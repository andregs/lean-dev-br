package br.dev.lean.wanderlust.catalog;

import java.util.List;
import java.util.Map;
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

  /** One bulk weather lookup for every destination — see WeatherService for the N+1 fan-out. */
  List<Destination> list() {
    List<Destination> destinations = catalog.all();
    Map<Coord, Weather> weatherByCoord = weatherService.weatherForAll(coordsOf(destinations));
    return destinations.stream().map(d -> withWeather(d, weatherByCoord)).toList();
  }

  Optional<Destination> find(String id) {
    return catalog.byId(id).map(d -> withWeather(d, weatherService.weatherForAll(coordsOf(List.of(d)))));
  }

  private static Destination withWeather(Destination destination, Map<Coord, Weather> weatherByCoord) {
    return destination.withWeather(weatherByCoord.get(coordOf(destination)));
  }

  private static List<Coord> coordsOf(List<Destination> destinations) {
    return destinations.stream().map(DestinationService::coordOf).toList();
  }

  private static Coord coordOf(Destination destination) {
    return new Coord(destination.latitude(), destination.longitude());
  }
}
