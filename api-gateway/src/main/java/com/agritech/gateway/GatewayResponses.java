package com.agritech.gateway;

import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/** Gateway-level rejections use the same error envelope as the services (PRD 7.3). */
final class GatewayResponses {

    private GatewayResponses() {}

    static Mono<Void> reject(ServerHttpResponse response, HttpStatus status, String code, String message) {
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String json = String.format("{\"error\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\"}",
                code, message.replace("\"", "'"), Instant.now());
        DataBuffer buffer = response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
