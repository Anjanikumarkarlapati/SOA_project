package com.agritech.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Runs first on every request: assigns a correlation id (or keeps a well-formed client one),
 * forwards it to the service, echoes it on the response, and writes one access-log line with
 * status and latency. Grep any service log for the id to follow one request across hops.
 */
@Component
public class RequestIdFilter implements GlobalFilter, Ordered {

    static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9-]{8,64}");
    private static final Logger access = LoggerFactory.getLogger("ACCESS");

    @Override
    public int getOrder() {
        return -200;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(HEADER);
        String id = incoming != null && SAFE_ID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        long start = System.nanoTime();

        ServerWebExchange tagged = exchange.mutate()
                .request(exchange.getRequest().mutate().headers(h -> h.set(HEADER, id)).build())
                .build();
        tagged.getResponse().getHeaders().set(HEADER, id);
        // API responses carry user data and tokens: never let a browser or proxy cache them.
        tagged.getResponse().getHeaders().setCacheControl("no-store");

        return chain.filter(tagged).doFinally(signal -> access.info("{} {} {} -> {} in {} ms",
                id, exchange.getRequest().getMethod(), exchange.getRequest().getPath().value(),
                tagged.getResponse().getStatusCode(), (System.nanoTime() - start) / 1_000_000));
    }
}
