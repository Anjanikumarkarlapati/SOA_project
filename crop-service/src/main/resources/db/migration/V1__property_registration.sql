-- Property registration baseline. Existing application tables remain managed by the current
-- Hibernate update process; these property tables are explicitly versioned from this migration.
CREATE SCHEMA IF NOT EXISTS crop_service;

CREATE TABLE IF NOT EXISTS crop_service.farm_properties (
    property_id VARCHAR(64) PRIMARY KEY,
    owner_email VARCHAR(320) NOT NULL,
    default_property BOOLEAN NOT NULL DEFAULT FALSE,
    farm_name VARCHAR(80) NOT NULL,
    land_size DOUBLE PRECISION NOT NULL DEFAULT 0,
    land_unit VARCHAR(10) NOT NULL,
    crop_id VARCHAR(40) NOT NULL,
    state VARCHAR(60),
    district VARCHAR(60),
    sensors VARCHAR(200),
    field_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    profile_json VARCHAR(8000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_owner ON crop_service.farm_properties (owner_email);

CREATE TABLE IF NOT EXISTS crop_service.property_water_details (
    property_id VARCHAR(64) PRIMARY KEY REFERENCES crop_service.farm_properties(property_id) ON DELETE CASCADE,
    water_source VARCHAR(40),
    availability VARCHAR(80),
    irrigation_type VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS crop_service.property_crop_intent (
    property_id VARCHAR(64) PRIMARY KEY REFERENCES crop_service.farm_properties(property_id) ON DELETE CASCADE,
    intent VARCHAR(80),
    season VARCHAR(120),
    start_date VARCHAR(10),
    end_date VARCHAR(10),
    previous_crops VARCHAR(1000)
);
