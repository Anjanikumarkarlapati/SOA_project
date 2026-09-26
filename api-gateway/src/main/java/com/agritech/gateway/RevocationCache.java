package com.agritech.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Tokens revoked by logout, pulled from auth-service so the gateway can reject them before they
 * expire on their own (FR-1).
 *
 * ponytail: a polled snapshot, so a logged-out token stays usable for up to one poll interval.
 * Shorten the interval, or move revocations to a shared Redis set, if that window matters.
 */
@Component
public class RevocationCache {

    private static final Logger log = LoggerFactory.getLogger(RevocationCache.class);

    private final AtomicReference<Set<String>> revoked = new AtomicReference<>(Set.of());
    private final WebClient authService;

    public RevocationCache(WebClient.Builder builder,
                           @Value("${agritech.services.auth-url:http://auth-service}") String authUrl) {
        this.authService = builder.baseUrl(authUrl.replaceAll("/+$", "")).build();
    }

    public boolean isRevoked(String jti) {
        return jti != null && revoked.get().contains(jti);
    }

    @Scheduled(fixedRateString = "${agritech.jwt.revocation-poll-ms:15000}", initialDelay = 5000)
    public void refresh() {
        authService.get().uri("/api/auth/revoked")
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Set<String>>() {})
                .timeout(Duration.ofSeconds(3))
                .doOnError(e -> log.debug("Revocation refresh failed: {}", e.getMessage()))
                .onErrorResume(e -> Mono.empty())
                .subscribe(revoked::set);
    }
}
