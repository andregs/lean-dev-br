package br.dev.lean.wanderlust.catalog;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

@Service
class WeatherService {

  private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

  private final WeatherClient client;

  WeatherService(WeatherClient client) {
    this.client = client;
  }

  /** Null on any upstream failure — destinations render without weather rather than failing. */
  Weather weatherFor(double latitude, double longitude) {
    try {
      return client.fetchOne(latitude, longitude);
    } catch (RestClientException | IllegalStateException ex) {
      log.warn("Open-Meteo call failed for ({}, {}): {}", latitude, longitude, ex.getMessage());
      return null;
    }
  }
}
