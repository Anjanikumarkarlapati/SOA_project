package com.agritech.auth;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** Demo accounts so the dashboard is usable the moment the stack is up. */
@Component
public class SeedData implements CommandLineRunner {

    private final UserRepository users;

    public SeedData(UserRepository users) { this.users = users; }

    @Override
    public void run(String... args) {
        if (users.count() > 0) return;
        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        users.save(new User("admin@agritech.io", enc.encode("admin1234"), "ADMIN", "FARM-001", "Farm Administrator"));
        users.save(new User("farmer@agritech.io", enc.encode("farmer1234"), "FARMER", "FARM-001", "Field Operator"));
    }
}
