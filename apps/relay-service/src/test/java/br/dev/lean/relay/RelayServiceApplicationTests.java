package br.dev.lean.relay;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = "relay.prune-token=test-token")
class RelayServiceApplicationTests {

	@Test
	void contextLoads() {
	}

}
