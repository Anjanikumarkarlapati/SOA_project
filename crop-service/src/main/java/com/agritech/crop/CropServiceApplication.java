package com.agritech.crop;

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
public class CropServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CropServiceApplication.class, args);
    }

    /**
     * Resolves lb://sensor-service through Eureka and round-robins across its instances (FR-9).
     * Short timeouts so a wedged sensor-service degrades this service instead of hanging it.
     */
    @Bean
    @LoadBalanced
    RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(4))
                .build();
    }
}
