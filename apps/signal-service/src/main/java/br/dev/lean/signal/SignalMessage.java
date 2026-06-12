package br.dev.lean.signal;

import tools.jackson.databind.JsonNode;

record SignalMessage(long at, JsonNode body) {}
