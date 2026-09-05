package com.agritech.irrigation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@SpringBootApplication(scanBasePackages = "com.agritech")
@EnableScheduling
public class IrrigationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IrrigationServiceApplication.class, args);
    }

    /** Eureka-resolved, load-balanced client for crop-service and sensor-service (FR-9). */
    @Bean
    @LoadBalanced
    RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(4))
                .build();
    }
}
