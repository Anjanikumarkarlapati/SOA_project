package com.agritech.gateway;

import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Spring Cloud Gateway {@code GlobalFilter}s do not run for Gateway-local Actuator WebFlux
 * endpoints. Require a valid, non-revoked ADMIN JWT for every Actuator path except health probes.
 */
@Component
@Order(-200)
public class ActuatorAuthWebFilter implements WebFilter {

    private final JwtAuthFilter jwtAuth;

    public ActuatorAuthWebFilter(JwtAuthFilter jwtAuth) {
        this.jwtAuth = jwtAuth;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (!path.equals("/actuator") && !path.startsWith("/actuator/")) {
            return chain.filter(exchange);
        }
        if (exchange.getRequest().getMethod() == HttpMethod.OPTIONS
                || (exchange.getRequest().getMethod() == HttpMethod.GET
                && (path.equals("/actuator/health") || path.startsWith("/actuator/health/")))) {
            return chain.filter(exchange);
        }
        JwtAuthFilter.AuthResult auth = jwtAuth.verifyHeader(
                exchange.getRequest().getHeaders().getFirst("Authorization"), path);
        if (!auth.ok()) {
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.UNAUTHORIZED,
                    auth.code(), auth.message());
        }
        if (!"ADMIN".equals(String.valueOf(auth.claims().get("role")))) {
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.FORBIDDEN,
                    "forbidden", "This action requires the administrator role");
        }
        return chain.filter(exchange);
    }
}
