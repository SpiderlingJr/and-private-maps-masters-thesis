
CREATE SCHEMA
IF NOT EXISTS "extensions";

CREATE EXTENSION
IF NOT EXISTS "postgis"
WITH SCHEMA "extensions";

-- CreateEnum
CREATE TYPE "JobState" AS ENUM
('PENDING', 'FINISHED', 'ERROR');

-- CreateTable
CREATE TABLE "PCollections"
(
    "coll_id" TEXT NOT NULL,
    "min_zoom" INTEGER NOT NULL DEFAULT 0,
    "max_zoom" INTEGER NOT NULL DEFAULT 22,
    "properties" JSONB,

    CONSTRAINT "PCollections_pkey" PRIMARY KEY ("coll_id")
);

-- CreateTable
CREATE TABLE "PFeatures"
(
    "id" TEXT NOT NULL,
    "ft_collection_id" TEXT NOT NULL,
    "geom"
        extensions.geometry NOT NULL,
    "properties" JSONB,

    CONSTRAINT "PFeatures_pkey" PRIMARY KEY
    ("id")
);

-- CreateTable
CREATE TABLE "PTmpFeatures"
(
    "id" TEXT NOT NULL,
    "geom"
        extensions.geometry,
    "properties" JSONB,

    CONSTRAINT "PTmpFeatures_pkey" PRIMARY KEY
        ("id")
);

-- CreateTable
CREATE TABLE "PJobs"
(
    "id" TEXT NOT NULL,
    "job_state" "JobState" NOT NULL DEFAULT 'PENDING',
    "job_note" TEXT,
    "job_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionsId" TEXT,

    CONSTRAINT "PJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geom_idx" ON "PFeatures" USING GIST
("geom");

-- CreateIndex
CREATE INDEX "tmp_geom_index" ON "PTmpFeatures" USING GIST
("geom");

-- AddForeignKey
ALTER TABLE "PFeatures" ADD CONSTRAINT "PFeatures_ft_collection_id_fkey" FOREIGN KEY ("ft_collection_id") REFERENCES "PCollections"("coll_id")
ON DELETE RESTRICT ON
UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PJobs" ADD CONSTRAINT "PJobs_collectionsId_fkey" FOREIGN KEY ("collectionsId") REFERENCES "PCollections"("coll_id") ON DELETE SET NULL ON UPDATE CASCADE;
