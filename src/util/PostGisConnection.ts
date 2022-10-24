import { createReadStream } from "fs";
import "reflect-metadata";
import { Features } from "src/entities/features.js";
import { Collections } from "src/entities/collections.js";
import { Jobs, JobState } from "src/entities/jobs.js";
import { DataSource } from "typeorm";

import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner.js";
import pgcopy from "pg-copy-streams";
import { pipeline } from "stream/promises";

export class PostGisConnection {
  conn: DataSource;

  async connectDB() {
    try {
      const dataSource = new DataSource({
        type: "postgres",
        host: "localhost",
        port: Number(process.env.PG_PORT),
        username: process.env.PG_USER,
        password: process.env.PG_PW,
        database: process.env.PG_DB,
        entities: [Features, Collections, Jobs],
        synchronize: true,
      });

      this.conn = await dataSource.initialize();
    } catch (err) {
      console.log("Error while trying to connect to database:\n" + err);
    }
  }
  constructor() {
    this.connectDB();
  }

  /**
   * Lets the database generate a new collection.
   * @returns id of the freshly generated collection
   */
  async createNewCollection(): Promise<string> {
    const newColl = Collections.create({});
    await newColl.save();

    return newColl.coll_id;
  }

  /**
   * Creates a new job with default state "pending"
   * @returns
   */
  async createNewJob(): Promise<string> {
    const newJob = Jobs.create({});
    await newJob.save();

    return newJob.job_id;
  }

  private isJobState(value: string): value is JobState {
    return ["pending", "finished", "error"].includes(value);
  }

  async updateJob(jobId: string, state: JobState, note?: string) {
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
    return Jobs.delete({ job_id: job });
  }

  async dropFeaturesByColid(colId: string) {
    return Collections.delete({ coll_id: colId });
  }

  async pgCopyInsert(file: string) {
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
      throw new Error("error in copyinsert");
    }
  }

  // TODO make this PATCH
  async pgCopyPatch(file: string) {
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
    const colls = Collections.find();
    return colls;
  }

  async getCollectionById(colId: string) {
    const coll = Collections.find({ where: { coll_id: colId } });

    return coll;
  }
  async getFeaturesByCollectionId(colId: string, limit?: number) {
    const feats = Features.createQueryBuilder()
      .where("ft_collection = :id", {
        id: colId,
      })
      .limit(limit)
      .execute();

    return feats;
  }

  async getFeatureByCollectionIdAndFeatureId(colId: string, featId: string) {
    const feat = Features.createQueryBuilder()
      .where("ft_collection = :col_id", { col_id: colId })
      .andWhere("feature_id = :ft_id", { ft_id: featId })
      .execute();

    return feat;
  }

  // FOR TESTING ----------
  async countJobs() {
    // = this.conn.manager.find(Jobs);
    return Jobs.count();
  }

  async countFeatures() {
    return Features.count();
  }
}
