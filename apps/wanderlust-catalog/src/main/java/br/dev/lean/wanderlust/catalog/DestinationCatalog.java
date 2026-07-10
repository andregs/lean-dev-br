package br.dev.lean.wanderlust.catalog;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

/** No datastore yet — a fixed seed is enough to prove the aggregation path. */
@Component
class DestinationCatalog {

  private static final List<Destination> SEED = List.of(
      new Destination(
          "fernando-de-noronha-br",
          "Fernando de Noronha",
          "Brazil",
          "Volcanic archipelago with turquoise bays and spinner dolphins.",
          "/images/fernando-de-noronha.jpg",
          -3.85, -32.42, null),
      new Destination(
          "machu-picchu-pe",
          "Machu Picchu",
          "Peru",
          "Incan citadel perched above the Sacred Valley.",
          "/images/machu-picchu.jpg",
          -13.16, -72.54, null),
      new Destination(
          "tierra-del-fuego-ar",
          "Tierra del Fuego",
          "Argentina",
          "Windswept archipelago at the southern tip of the continent.",
          "/images/tierra-del-fuego.jpg",
          -54.8, -68.3, null));

  List<Destination> all() {
    return SEED;
  }

  Optional<Destination> byId(String id) {
    return SEED.stream().filter(d -> d.id().equals(id)).findFirst();
  }
}
