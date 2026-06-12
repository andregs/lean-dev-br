package br.dev.lean.signal;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {

    private final SignalProperties props;

    CorsConfig(SignalProperties props) {
        this.props = props;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/signal/**")
                .allowedOrigins(props.cors().allowedOrigins())
                .allowedMethods("GET", "POST")
                .maxAge(3600);
    }
}
