package br.dev.lean.wanderlust.bff;

class UpstreamUnavailableException extends RuntimeException {
  UpstreamUnavailableException(String message, Throwable cause) {
    super(message, cause);
  }
}
