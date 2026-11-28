package com.agritech.climate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.agritech")
public class ClimateServiceApplication {
    public static void main(String[] args) { SpringApplication.run(ClimateServiceApplication.class, args); }
}
