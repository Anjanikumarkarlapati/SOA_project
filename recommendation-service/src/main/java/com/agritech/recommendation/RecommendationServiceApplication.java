package com.agritech.recommendation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.agritech")
public class RecommendationServiceApplication {
    public static void main(String[] args) { SpringApplication.run(RecommendationServiceApplication.class, args); }
}
