ALTER TABLE crop_service.farm_properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE crop_service.farm_properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE crop_service.farm_properties ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE crop_service.farm_properties ADD COLUMN IF NOT EXISTS boundary_geo_json VARCHAR(100000);
ALTER TABLE crop_service.farm_properties ADD COLUMN IF NOT EXISTS soil_type VARCHAR(60);
