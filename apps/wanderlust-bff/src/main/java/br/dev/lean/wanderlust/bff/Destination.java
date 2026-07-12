package br.dev.lean.wanderlust.bff;

/** Mirrors catalog's response shape — the OpenAPI contract this re-serves as-is. */
record Destination(
    String id,
    String name,
    String country,
    String description,
    String imageUrl,
    double latitude,
    double longitude,
    Weather weather) {}
