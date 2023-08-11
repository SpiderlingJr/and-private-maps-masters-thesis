CREATE EXTENSION IF NOT EXISTS postgis;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    collections (
        coll_id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        min_zoom int DEFAULT 0,
        max_zoom int DEFAULT 22,
        properties jsonb NULL
    );

CREATE TABLE
    features (
        feature_id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        ft_collection uuid,
        geom GEOMETRY (GEOMETRY, 4326),
        properties jsonb NULL,
        FOREIGN KEY (ft_collection) REFERENCES collections (id) ON DELETE CASCADE ON UPDATE CASCADE
    );

CREATE TABLE
    patch_features (
        feature_id uuid PRIMARY KEY,
        ft_collection uuid,
        geom GEOMETRY (GEOMETRY, 4326),
        properties jsonb NULL,
        FOREIGN KEY (ft_collection) REFERENCES collections (id) ON DELETE CASCADE ON UPDATE CASCADE
    );

CREATE TYPE job_state_enum AS ENUM('pending', 'finished', 'error');

-- Create the jobs table
CREATE TABLE
    jobs (
        job_id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
        job_state job_state_enum DEFAULT 'pending',
        job_collection varchar(512) NULL,
        job_note varchar(512) NULL,
        job_date timestamptz DEFAULT CURRENT_TIMESTAMP
    );

-- replace maximum loop count. 
-- Attention: Going beyong 10 will take a LONG time!!
DO $$
DECLARE
    tbl_name text;
BEGIN
    FOR i IN 1..14 LOOP
        tbl_name := 'mvt' || i;
        
        EXECUTE 'CREATE TABLE ' || tbl_name || ' (
            x smallint,
            y smallint,
            geom GEOMETRY(GEOMETRY, 4326),
            PRIMARY KEY (x, y)
        )';
    END LOOP;
END $$;

-- Create mvt prefabs for each zoom level
CREATE
OR REPLACE FUNCTION fill_mvts (zoom_level integer, target_table text) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    INSERT INTO %I (x, y, geom)
    SELECT x, y, ST_AsBinary(geom) as geom
    FROM (
      SELECT
        x, y,
        ST_Transform(ST_SetSRID(ST_TileEnvelope($1, x, y), 3857), 4326) AS geom
      FROM generate_series(0, (2^$1::integer - 1)::integer) AS x,
           generate_series(0, (2^$1::integer - 1)::integer) AS y
    ) AS tiles
  ', target_table) USING zoom_level;
END
$$ LANGUAGE plpgsql;

INSERT INTO
    features (feature_id, geom, properties)
VALUES
    (
        '22474336-c17d-4ca9-a35d-34f8361a89d2',
        ST_GeomFromGeoJSON (
            '{"type":"Feature","geometry":{"coordinates":[[[50.69002933248774,-37.49017283962983],[50.69002933248774,38.757972249286865],[-26.66799103718145,38.710605818676754],[-26.942918422215257,9.071978618983906],[7.837843749102291,6.959414863108563],[8.211300380242562,-37.61490210257571],[50.69002933248774,-37.49017283962983]]],"type":"Polygon"}}'
        ),
        '{"is":"africa","description":"L-shaped polygon"}'
    );

INSERT INTO
    features (feature_id, geom, properties)
VALUES
    (
        '22474336-c17d-4ca9-a35d-34f8361a89d2',
        ST_GeomFromGeoJSON (
            '{"type":"Feature","properties":{"date":"230717","is":"africaWestPatch","description":"simpleL-Shapedpolygonaroundafrica"},"geometry":{"coordinates":[[[50.69002933248774,-37.49017283962983],[50.69002933248774,38.757972249286865],[7.589744617279116,37.95184981777541],[-12.2485490256865,35.49063206644619],[-24.219843573895673,22.11622100366675],[-13.084946127539354,3.627346479329759],[8.053971754493006,1.3563556266067849],[8.211300380242562,-37.61490210257571],[50.69002933248774,-37.49017283962983]]],"type":"Polygon"}}'
        ),
        '{"is":"africa","description":"L-shaped polygon"}'
    );