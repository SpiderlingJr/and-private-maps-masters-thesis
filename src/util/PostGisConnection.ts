import { createReadStream } from "fs";
import { Features } from "src/entities/features.js";
import { Collections } from "src/entities/collections.js";
import { Jobs, JobState } from "src/entities/jobs.js";
import { DataSource } from "typeorm";

import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner.js";
import pgcopy from "pg-copy-streams";
import { pipeline } from "stream/promises";

export class PostGisConnection {
  conn: DataSource; // = null <--
  connPromise: Promise<DataSource>;

  async connectDB(): Promise<DataSource> {
    try {
      this.conn = new DataSource({
        type: "postgres",
        host: "localhost",
        port: Number(process.env.PG_PORT),
        username: process.env.PG_USER,
        password: process.env.PG_PW,
        database: process.env.PG_DB,
        entities: [Features, Collections, Jobs],
        synchronize: true,
      });

      return this.conn.initialize();
    } catch (err) {
      throw new Error("Error while trying to connect to database:\n" + err);
    }
  }

  constructor() {
    this.connPromise = this.connectDB();
  }

  async initialized() {
    await this.connPromise;
  }

  /**
   * Lets the database generate a new collection.
   * @returns id of the freshly generated collection
   */
  async createNewCollection(): Promise<string> {
    await this.initialized();

    const newColl = Collections.create({});
    await newColl.save();

    return newColl.coll_id;
  }

  /**
   * Creates a new job with default state "pending"
   * @returns
   */
  async createNewJob(): Promise<string> {
    await this.initialized();

    const newJob = Jobs.create({});
    await newJob.save();

    return newJob.job_id;
  }

  private isJobState(value: string): value is JobState {
    return ["pending", "finished", "error"].includes(value);
  }

  async updateJob(jobId: string, state: JobState, note?: string) {
    await this.initialized();

    if (!this.isJobState(state)) {
      return;
    }
    await this.conn
      .createQueryBuilder()
      .update(Jobs)
      .set({ job_state: state, job_note: note })
      .where("job_id = :id", { id: jobId })
      .execute();
  }

  async dropJob(job: string) {
    await this.initialized();

    return Jobs.delete({ job_id: job });
  }

  async dropFeaturesByColid(colId: string) {
    await this.initialized();

    return Collections.delete({ coll_id: colId });
  }

  async pgCopyInsert(file: string) {
    await this.initialized();

    try {
      const queryRunner = this.conn.createQueryRunner();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();
      await pipeline(
        createReadStream(file),
        pgConn.query(
          pgcopy.from(
            "COPY features_test(geom, properties, ft_collection) FROM STDIN (FORMAT CSV, DELIMITER ';')"
          )
        )
      );
    } catch (err) {
      throw new Error("error in copyinsert:\n" + err);
    }
  }

  // TODO make this PATCH
  async pgCopyPatch(file: string) {
    await this.initialized();

    const queryRunner = this.conn.createQueryRunner();
    const pgConn = await (<PostgresQueryRunner>queryRunner).connect();
    await pipeline(
      createReadStream(file),
      pgConn.query(
        pgcopy.from(
          "COPY features_test(geom, properties) FROM STDIN (FORMAT CSV, DELIMITER ';')"
        )
      )
    );
  }

  // TODO ake this PUT
  async pgCopyPut(file: string) {
    await this.initialized();

    const queryRunner = this.conn.createQueryRunner();
    const pgConn = await (<PostgresQueryRunner>queryRunner).connect();
    await pipeline(
      createReadStream(file),
      pgConn.query(
        pgcopy.from(
          "COPY features_test(geom, properties) FROM STDIN (FORMAT CSV, DELIMITER ';')"
        )
      )
    );
  }

  async listCollections() {
    await this.initialized();

    const colls = Collections.find();
    return colls;
  }

  async getCollectionById(colId: string) {
    await this.initialized();

    const coll = Collections.find({ where: { coll_id: colId } });

    return coll;
  }
  async getFeaturesByCollectionId(colId: string, limit?: number) {
    await this.initialized();

    const feats = Features.createQueryBuilder()
      .where("ft_collection = :id", {
        id: colId,
      })
      .limit(limit)
      .execute();

    return feats;
  }

  async getFeatureByCollectionIdAndFeatureId(colId: string, featId: string) {
    await this.initialized();

    const feat = Features.createQueryBuilder()
      .where("ft_collection = :col_id", { col_id: colId })
      .andWhere("feature_id = :ft_id", { ft_id: featId })
      .execute();

    return feat;
  }

  // FOR TESTING ----------
  async countJobs() {
    await this.initialized();

    // = this.conn.manager.find(Jobs);
    return Jobs.count();
  }

  async countFeatures() {
    await this.initialized();

    return Features.count();
  }

  async close() {
    await this.conn.destroy();
  }

  async mvtDummyData() {
    await this.initialized();

    const data = Features.query(
      "WITH mvtgeom\
       AS(SELECT ST_AsMVTGeom(geom, ST_TileEnvelope(0, 0, 0), extent => 4096, buffer => 64) AS geom, properties \
      FROM features_test \
      WHERE geom && ST_TileEnvelope(0, 0, 0, margin => (64.0 / 4096))) \
      SELECT ST_AsMVT(mvtgeom.*, 'banana', 4096) FROM mvtgeom;"
    );

    return data;
  }

  async getMVT(
    collId: string,
    z: number,
    x: number,
    y: number,
    extent = 4096,
    buffer = 64,
    name = "default"
  ) {
    // Prevent division by 0
    if (extent < 1) throw new Error("Extent must be > 1");

    const buffer_fp = buffer * 1.0;
    const feature_table = "features_test";
    const mvt_tmpl = `WITH mvtgeom AS ( \
    SELECT ST_AsMVTGeom(geom, ST_TileEnvelope(${z},${x},${y}, extent => ${extent},  buffer => ${buffer}) AS geom, properties \
      FROM ${feature_table} \
      WHERE geom && ST_TileEnvelope(${z},${x},${y}, margin=> (${buffer_fp}/${extent}))) \
    SELECT ST_AsMVT(mvtgeom.*, '${name}') FROM mvtgeom;`;

    const mvt_resp = Features.query(mvt_tmpl);
    return mvt_resp;
  }
}
