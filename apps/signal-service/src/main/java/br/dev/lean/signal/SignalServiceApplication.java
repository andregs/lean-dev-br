package br.dev.lean.signal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
@org.springframework.boot.context.properties.EnableConfigurationProperties(RelayProperties.class)
public class SignalServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(SignalServiceApplication.class, args);
	}

}
