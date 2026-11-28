-- V1 baseline: users + stored_tokens, owned by Flyway from here on.
-- This is the "fresh UUID schema" reset agreed for the hackathon: an existing pre-Flyway
-- database is baselined at version 0 and this migration replaces the legacy tables.
-- SQL is written to run on both H2 (dev/test default) and PostgreSQL (Supabase via DB_URL).

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS stored_tokens;

-- users: one row per account, idempotent on repeat logins via two unique constraints:
--   uq_users_email            -> email is the stable identity for LOCAL logins
--   uq_users_provider         -> (auth_provider, provider_id) is the stable identity for OAuth
--        (PostgreSQL/H2 treat NULL provider_id values as distinct, so LOCAL accounts are
--         constrained by the email unique alone.)
CREATE TABLE users (
    id             UUID PRIMARY KEY,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255),
    auth_provider  VARCHAR(32)   NOT NULL,          -- LOCAL or GOOGLE
    provider_id    VARCHAR(255),                    -- Supabase user id for GOOGLE accounts
    role           VARCHAR(32)   NOT NULL,          -- ADMIN or FARMER
    farm_id        VARCHAR(64)   NOT NULL,          -- tenant for sensor/irrigation services
    name           VARCHAR(255),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    last_login_at  TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_users_email    UNIQUE (email),
    CONSTRAINT uq_users_provider UNIQUE (auth_provider, provider_id)
);

CREATE INDEX idx_users_provider_id ON users (provider_id);

-- Refresh tokens and revoked access-token jtis (see TokenStore).
CREATE TABLE stored_tokens (
    id          VARCHAR(64)              NOT NULL PRIMARY KEY,  -- refresh token or jti
    email       VARCHAR(255),
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked     BOOLEAN                  NOT NULL DEFAULT FALSE
);
