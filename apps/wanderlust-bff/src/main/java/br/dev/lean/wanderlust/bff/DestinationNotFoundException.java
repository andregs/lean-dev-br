package br.dev.lean.wanderlust.bff;

class DestinationNotFoundException extends RuntimeException {
  DestinationNotFoundException(String id) {
    super("No destination with id " + id);
  }
}
