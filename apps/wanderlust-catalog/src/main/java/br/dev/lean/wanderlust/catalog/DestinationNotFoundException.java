package br.dev.lean.wanderlust.catalog;

class DestinationNotFoundException extends RuntimeException {
  DestinationNotFoundException(String id) {
    super("No destination with id " + id);
  }
}
