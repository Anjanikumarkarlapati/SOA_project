package com.agritech.crop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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

    /** Short timeouts so a wedged sensor-service degrades this service instead of hanging it. */
    private static RestTemplate build(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(4))
                .build();
    }

    /**
     * Resolves lb://sensor-service through Eureka and round-robins across its instances (FR-9).
     * This is the default: the load balancer needs a service id as the host, so it can only be
     * used while Eureka is on.
     */
    @Bean
    @LoadBalanced
    @ConditionalOnProperty(name = "eureka.client.enabled", havingValue = "true", matchIfMissing = true)
    RestTemplate loadBalancedRestTemplate(RestTemplateBuilder builder) {
        return build(builder);
    }

    /**
     * Without a registry there is nothing to resolve, so the client calls the absolute URL in
     * agritech.services.sensor-url directly. @LoadBalanced here would try to read the hostname as
     * a service id and fail.
     */
    @Bean
    @ConditionalOnProperty(name = "eureka.client.enabled", havingValue = "false")
    RestTemplate directRestTemplate(RestTemplateBuilder builder) {
        return build(builder);
    }
}
