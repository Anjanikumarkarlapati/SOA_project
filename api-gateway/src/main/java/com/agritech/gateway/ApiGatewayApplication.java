package com.agritech.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.reactive.function.client.WebClient;

@SpringBootApplication
@EnableScheduling
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    /** Resolves lb://auth-service through Eureka for the revocation poll. */
    @Bean
    @LoadBalanced
    @ConditionalOnProperty(name = "eureka.client.enabled", havingValue = "true", matchIfMissing = true)
    WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder();
    }

    /** No registry: the revocation poll uses the absolute agritech.services.auth-url instead. */
    @Bean
    @ConditionalOnProperty(name = "eureka.client.enabled", havingValue = "false")
    WebClient.Builder directWebClientBuilder() {
        return WebClient.builder();
    }
}
