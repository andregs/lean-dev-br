package br.dev.lean.wanderlust.bff;

import java.util.List;
import java.util.Optional;

/** Replaced by a gRPC client once catalog exposes one (temporary REST seam). */
interface CatalogClient {
  List<Destination> list();

  Optional<Destination> find(String id);
}
