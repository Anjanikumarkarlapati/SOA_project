package com.agritech.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/** "Try it out" targets the gateway: InternalAuth rejects /api calls made straight to a service port. */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI openApi(@Value("${spring.application.name}") String name,
                    @Value("${agritech.gateway-url:http://localhost:8080}") String gatewayUrl) {
        return new OpenAPI()
                .info(new Info().title("AgriTech " + name).version("1.0.0"))
                .servers(List.of(new Server().url(gatewayUrl).description("API gateway")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }
}
