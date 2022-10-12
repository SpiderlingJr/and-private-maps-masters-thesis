DROP TABLE IF EXISTS collections;

DROP TABLE IF EXISTS jobs;

DROP TABLE IF EXISTS features;

CREATE TYPE proc_state as ENUM ('pending', 'finished', 'error');

CREATE TABLE
    jobs (
        job_id uuid DEFAULT uuid_generate_v4(),
        job_state proc_state DEFAULT 'pending',
        job_note varchar(512),
        PRIMARY KEY (job_id)
    );

CREATE TABLE
    collections (
        coll_id uuid DEFAULT uuid_generate_v4(),
        PRIMARY KEY (coll_id)
    );

-- CREATE Geometry table, auto generate id

CREATE TABLE
    features (
        feature_id uuid DEFAULT uuid_generate_v4(),
        ft_collection uuid,
        geom geometry,
        properties jsonb,
        CONSTRAINT fk_collection FOREIGN KEY(ft_collection) REFERENCES collections(coll_id),
        PRIMARY KEY (feature_id)
    );

-- SET default Geometry SRID to 3857

SELECT UpdateGeometrySRID('public', 'features', 'geom', 3857);

SELECT Find_SRID('public', 'features', 'geom');