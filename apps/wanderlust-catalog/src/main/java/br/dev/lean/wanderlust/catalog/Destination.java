package br.dev.lean.wanderlust.catalog;

record Destination(
    String id,
    String name,
    String country,
    String description,
    String imageUrl,
    double latitude,
    double longitude,
    Weather weather) {

  Destination withWeather(Weather weather) {
    return new Destination(id, name, country, description, imageUrl, latitude, longitude, weather);
  }
}
