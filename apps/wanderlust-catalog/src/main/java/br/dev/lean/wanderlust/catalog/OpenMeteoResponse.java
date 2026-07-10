package br.dev.lean.wanderlust.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

record OpenMeteoResponse(Current current) {
  record Current(
      @JsonProperty("temperature_2m") double temperature2m,
      @JsonProperty("weather_code") int weatherCode) {}
}
