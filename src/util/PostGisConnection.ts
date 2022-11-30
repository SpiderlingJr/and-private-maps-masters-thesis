import { createReadStream } from "fs";
import { TmpFeatures, Features } from "src/entities/features.js";
import { Collections } from "src/entities/collections.js";
import { Jobs, JobState } from "src/entities/jobs.js";
import { DataSource } from "typeorm";

import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner.js";
import pgcopy from "pg-copy-streams";
import { pipeline } from "stream/promises";

import { styleSchema } from "../schema/httpRequestSchemas.js";

const features_db = "features_test";

export class PostGisConnection {
  conn: DataSource;
  connPromise: Promise<DataSource>;

  async connectDB(): Promise<DataSource> {
    try {
      this.conn = new DataSource({
        type: "postgres",
        host: "localhost",
        port: Number(process.env.POSTGRES_EXPOSE),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [Features, Collections, Jobs, TmpFeatures],
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

  async updateJob(
    jobId: string,
    state: JobState,
    colId: string | undefined,
    note?: string
  ) {
    await this.initialized();

    if (!this.isJobState(state)) {
      return;
    }
    await this.conn
      .createQueryBuilder()
      .update(Jobs)
      .set({ job_state: state, job_note: note, job_collection: colId })
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

  async pgPatch(file: string) {
    try {
      const queryRunner = this.conn.createQueryRunner();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();

      await queryRunner.startTransaction();
      try {
        await queryRunner.clearTable("tmp_features");
        await pipeline(
          createReadStream(file),
          pgConn.query(
            pgcopy.from(
              `COPY tmp_features(feature_id, properties, geom) FROM STDIN (FORMAT CSV, DELIMITER ';')`
            )
          )
        );
        const updatableRows = await queryRunner.manager.count("tmp_features");

        const resp = await pgConn.query(
          `UPDATE features_test
            SET properties = features_test.properties || tmp_features.properties
            FROM tmp_features
            WHERE features_test.feature_id = tmp_features.feature_id;`
        );
        const updatedRows = Number(resp.rowCount);

        if (updatableRows != updatedRows)
          throw new Error(
            "Tried to patch a feature that did not exist in features!"
          );

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      throw new Error("Error in pgPatch:\n" + err);
    }
  }
  /**
   *
   * @param featId uuid of feature to be patched
   * @param feature
   * @throws NotFoundError if feature with featId doesnt exist in db
   */
  async patchFeature(featId: string, feature: object) {
    await this.initialized();

    // upload into temporary table
    // merge into fids
    const patch_tmpl = `
    UPDATE ${features_db}
      SET properties = '${feature}'::jsonb || properties
      WHERE feature_id = ${featId}`;
    const response = Features.query(patch_tmpl);
    console.log(JSON.stringify(response));
  }

  async pgCopyPut(file: string) {
    await this.initialized();

    const queryRunner = this.conn.createQueryRunner();
    const pgConn = await (<PostgresQueryRunner>queryRunner).connect();
    await pipeline(
      createReadStream(file),
      pgConn.query(
        pgcopy.from(
          `COPY ${features_db} (geom, properties) FROM STDIN (FORMAT CSV, DELIMITER ';')`
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

  /**
   * Requests minZoom and maxZoom of a collection
   * @param collId id of requested collection
   * @returns
   */
  async getCollectionZoomLevel(
    collId: string
  ): Promise<{ minZoom: number; maxZoom: number }> {
    await this.initialized();

    const collection = await this.getCollectionById(collId);
    const minZoom = collection[0].min_zoom;
    const maxZoom = collection[0].max_zoom;

    return { minZoom: minZoom, maxZoom: maxZoom };
  }

  async countJobs() {
    await this.initialized();

    return await Jobs.count();
  }

  async countFeatures() {
    await this.initialized();

    return await Features.count();
  }

  async deleteCollection(colId: string, jobId: string) {
    await this.initialized();

    const deleteResponse = await Collections.createQueryBuilder()
      .delete()
      .where("coll_id =:id", { id: colId })
      .execute();

    console.log(deleteResponse);
  }

  async close() {
    await this.conn.destroy();
  }

  async getJobById(jobId: string) {
    await this.initialized();

    const jobData = await Jobs.find({ where: { job_id: jobId } });

    return jobData;
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

    const mvt_tmpl = `WITH mvtgeom AS (\
    SELECT ST_AsMVTGeom(geom, ST_TileEnvelope(${z},${x},${y}), extent => ${extent},  buffer => ${buffer}) AS geom, properties \
      FROM ${feature_table} \
      WHERE geom && ST_TileEnvelope(${z},${x},${y}, margin=> (${buffer_fp}/${extent})) \
      AND ft_collection = '${collId}') \
    SELECT ST_AsMVT(mvtgeom.*, '${name}') FROM mvtgeom;`;

    const mvt_resp = await Features.query(mvt_tmpl);

    return mvt_resp;
  }

  async setStyle(collId: string, style: object) {
    await this.initialized();

    const { minZoom, maxZoom } = style as typeof styleSchema;

    const res = await Collections.createQueryBuilder()
      .update()
      .set({ min_zoom: minZoom, max_zoom: maxZoom })
      .where("coll_id = :cid", { cid: collId })
      .execute();

    if (res.affected == 0) {
      throw new Error("No such collection");
    }
    // TODO might be handled more generally later. for now, only maxZoom and minZoom are of updated
  }
}
