package br.dev.lean.relay;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {

    private final RelayProperties props;

    CorsConfig(RelayProperties props) {
        this.props = props;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/rooms/**")
                .allowedOrigins(props.cors().allowedOrigins())
                .allowedMethods("GET", "POST")
                .maxAge(3600);
    }
}
