package br.dev.lean.wanderlust.catalog;

import java.util.logging.Level;
import java.util.logging.LogManager;
import java.util.logging.Logger;

import org.slf4j.bridge.SLF4JBridgeHandler;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CatalogProperties.class)
public class WanderlustCatalogApplication {

	public static void main(String[] args) {
		// OTel's own exporter/BatchSpanProcessor log via java.util.logging, not
		// SLF4J — bridge it before anything else runs so those records reach
		// Logback (see logging.level.io.opentelemetry.* in application-prod.yaml).
		LogManager.getLogManager().reset();
		Logger.getLogger("io.opentelemetry.exporter").setLevel(Level.FINE);
		Logger.getLogger("io.opentelemetry.sdk.trace.export").setLevel(Level.FINE);
		SLF4JBridgeHandler.install();

		SpringApplication.run(WanderlustCatalogApplication.class, args);
	}

}
