CREATE SCHEMA IF NOT EXISTS recommendation_service;
CREATE TABLE recommendation_service.crops (
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
