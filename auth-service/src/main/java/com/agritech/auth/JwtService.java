package com.agritech.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTtlMs;

    public JwtService(@Value("${agritech.jwt.secret}") String secret,
                      @Value("${agritech.jwt.access-ttl-minutes:15}") long accessTtlMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtlMs = accessTtlMinutes * 60_000L;
    }

    /** FR-1: short-lived (default 15 min) access token carrying role + farm identifier. */
    public String issue(User user) {
        Date now = new Date();
        return Jwts.builder()
                .setId(UUID.randomUUID().toString())
                .setSubject(user.getEmail())
                .claim("role", user.getRole())
                .claim("farmId", user.getFarmId())
                .claim("name", user.getDisplayName())
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + accessTtlMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }

    public long accessTtlSeconds() { return accessTtlMs / 1000; }
}
