package br.dev.lean.relay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@org.springframework.boot.context.properties.EnableConfigurationProperties({
    RelayProperties.class,
    OtelProperties.class
})
public class RelayServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(RelayServiceApplication.class, args);
	}

}
