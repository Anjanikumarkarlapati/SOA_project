-- The legacy operational `crops` table represented fields. Rename it before creating the
-- requested agronomic reference table; on a fresh install this is a no-op.
ALTER TABLE IF EXISTS crop_service.crops RENAME TO crop_fields;

CREATE TABLE IF NOT EXISTS crop_service.crop_fields (
    crop_id VARCHAR(255) PRIMARY KEY,
    farm_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    crop_type VARCHAR(255) NOT NULL,
    valve_id VARCHAR(255),
    area_hectares DOUBLE PRECISION NOT NULL,
    planted_on DATE,
    moisture_min DOUBLE PRECISION NOT NULL,
    moisture_max DOUBLE PRECISION NOT NULL,
    temperature_min DOUBLE PRECISION NOT NULL,
    temperature_max DOUBLE PRECISION NOT NULL,
    ph_min DOUBLE PRECISION NOT NULL,
    ph_max DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS crop_service.crops (
    crop_id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    crop_group VARCHAR(60) NOT NULL,
    temperature_min_c DOUBLE PRECISION NOT NULL,
    temperature_max_c DOUBLE PRECISION NOT NULL,
    water_need_mm DOUBLE PRECISION NOT NULL,
    soil_preference VARCHAR(80) NOT NULL,
    season_windows VARCHAR(40) NOT NULL,
    duration_days INTEGER NOT NULL
);
