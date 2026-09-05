package com.agritech.sensor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.agritech")
@EnableScheduling
public class SensorServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(SensorServiceApplication.class, args);
    }
}
