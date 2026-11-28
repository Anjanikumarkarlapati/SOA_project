package com.agritech.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Demo accounts so the dashboard is usable the moment the stack is up.
 *
 * <p>These are public, well-known credentials, so they are a liability anywhere but on a laptop.
 * The runner is therefore opt-out ({@code agritech.seed-demo-accounts}, default {@code true} for the
 * hackathon demo) and says out loud in the log which accounts exist. Set it to {@code false} before
 * deploying, and promote operators by hand afterwards - self-registration can no longer produce an
 * ADMIN (see {@link AuthService#register}).
 */
@Component
public class SeedData implements CommandLineRunner {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final UserRepository users;
    private final boolean enabled;

    public SeedData(UserRepository users,
                    @Value("${agritech.seed-demo-accounts:true}") boolean enabled) {
        this.users = users;
        this.enabled = enabled;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            audit.info("demo accounts disabled (agritech.seed-demo-accounts=false): no accounts seeded");
            return;
        }
        if (users.count() > 0) return;
        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        users.save(User.local("admin@agritech.io", enc.encode("admin1234"), "ADMIN", "FARM-001", "Farm Administrator"));
        users.save(User.local("farmer@agritech.io", enc.encode("farmer1234"), "FARMER", "FARM-001", "Field Operator"));
        audit.warn("SEEDED demo accounts admin@agritech.io / farmer@agritech.io with known passwords."
                + " Change them, or set agritech.seed-demo-accounts=false before deploying.");
    }
}
