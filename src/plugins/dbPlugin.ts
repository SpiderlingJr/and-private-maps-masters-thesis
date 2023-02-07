/* Plugin handling database connections */

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import pgcopy from "pg-copy-streams";

import { pipeline } from "stream/promises";
import { createReadStream } from "fs";
import { DataSource, DeleteResult, UpdateResult } from "typeorm";
import { TmpFeatures, Features, PatchFeatures } from "src/entities/features.js";
import { Collections } from "src/entities/collections.js";
import { Jobs, JobState } from "src/entities/jobs.js";
import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner";
import { styleSchema } from "../schema/httpRequestSchemas.js";

interface MVTResponse {
  st_asmvt: string;
}
declare module "fastify" {
  interface FastifyInstance {
    db: PostgresDB;
  }
}
interface PostgresDB {
  getJobById(jobId: string): Promise<Jobs | null>;
  setStyle(
    collId: string,
    Style: { minZoom: number; maxZoom: number }
  ): Promise<UpdateResult>;
  //mvtDummyData(): unknown;
  createJob(): Promise<string>;
  updateJob(
    jobId: string,
    state: JobState,
    colId?: string,
    note?: string
  ): Promise<UpdateResult | undefined>;
  createCollection(): Promise<string>;
  listCollections(): Promise<Collections[]>;
  getCollectionById(collId: string): Promise<Collections | null>;
  getCollectionZoomLevel(
    collId: string
  ): Promise<{ minZoom: number; maxZoom: number }>;

  updateCollection(collectionId: string): Promise<string>;
  deleteCollection(collectionId: string): Promise<DeleteResult>;
  copyStreamCollection(collectionPath: string): Promise<unknown>;
  getFeaturesByCollectionId(
    collId: string,
    limit?: number
  ): Promise<Features[] | null>;
  getFeatureByCollectionIdAndFeatureId(
    collId: string,
    featId: string
  ): Promise<Features | null>;

  getMVT(
    collId: string,
    z: number,
    x: number,
    y: number,
    extent?: number,
    buffer?: number,
    name?: string
  ): Promise<MVTResponse[]>;
  testme(): Promise<any>;

  patchAndGetDiff(patchPath: string): Promise<any>;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const dbPlugin: FastifyPluginAsync = async (fastify) => {
  /*fastify.register(fastifyPostgres, {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_EXPOSE),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  */
  let conn: DataSource;
  async function connectDB(): Promise<DataSource> {
    try {
      conn = new DataSource({
        type: "postgres",
        host: "localhost",
        port: Number(process.env.POSTGRES_EXPOSE),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [Features, Collections, Jobs, TmpFeatures, PatchFeatures],
        synchronize: true,
      });

      return conn.initialize();
    } catch (err) {
      throw new Error("Error while trying to connect to database:\n" + err);
    }
  }
  function isJobState(value: string): value is JobState {
    return ["pending", "finished", "error"].includes(value);
  }

  conn = await connectDB();

  fastify.decorate("db", {
    async testme() {
      return await conn.query("SELECT * FROM somepolys");
    },
    async createJob() {
      const job = Jobs.create({});
      await job.save();
      return job.job_id;
    },
    async updateJob(
      jobId: string,
      state: JobState,
      colId: string,
      note?: string
    ) {
      if (!isJobState(state)) {
        return;
      }
      const res = await conn
        .createQueryBuilder()
        .update(Jobs)
        .set({ job_state: state, job_note: note, job_collection: colId })
        .where("job_id = :id", { id: jobId })
        .execute();

      if (res.affected == 0) {
        throw new Error("No such job");
      } else {
        return res;
      }
    },
    async getJobById(jobId: string) {
      const job = await Jobs.findOne({ where: { job_id: jobId } });
      return job;
    },

    async setStyle(collId: string, style: object) {
      const { minZoom, maxZoom } = style as typeof styleSchema;

      const res = await Collections.createQueryBuilder()
        .update()
        .set({ min_zoom: minZoom, max_zoom: maxZoom })
        .where("coll_id = :cid", { cid: collId })
        .execute();

      if (res.affected == 0) {
        throw new Error("No such collection");
      } else {
        return res;
      }
      // TODO might be handled more generally later. for now, only maxZoom and minZoom are of updated
    },
    async createCollection() {
      const coll = Collections.create({});
      await coll.save();
      return coll.coll_id;
    },
    async listCollections() {
      const colls = await Collections.find();
      return colls;
    },
    /**
     * Streams contents of validated csv file to db
     * @param fpath
     */
    async copyStreamCollection(collectionPath: string) {
      const query =
        "COPY features_test(geom, properties, ft_collection) FROM STDIN (FORMAT CSV, DELIMITER ';')";
      const copyQuery = pgcopy.from(query);
      const queryRunner = conn.createQueryRunner();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();

      return await pipeline(
        createReadStream(collectionPath),
        pgConn.query(copyQuery)
      );
    },
    async getFeaturesByCollectionId(colId: string, limit?: number) {
      const feats = await Features.createQueryBuilder()
        .where("ft_collection = :id", {
          id: colId,
        })
        .limit(limit)
        .execute();

      return feats;
    },
    async getFeatureByCollectionIdAndFeatureId(colId: string, featId: string) {
      const feat = Features.createQueryBuilder()
        .where("ft_collection = :col_id", { col_id: colId })
        .andWhere("feature_id = :ft_id", { ft_id: featId })
        .execute();

      return feat;
    },
    async getCollectionById(colId: string) {
      const coll = await Collections.findOne({ where: { coll_id: colId } });

      return coll;
    },
    async getCollectionZoomLevel(
      collId: string
    ): Promise<{ minZoom: number; maxZoom: number }> {
      const collection = await this.getCollectionById(collId);

      if (!collection) {
        throw new Error("No such collection");
      }

      const minZoom = collection.min_zoom;
      const maxZoom = collection.max_zoom;

      return { minZoom: minZoom, maxZoom: maxZoom };
    },
    /**
     *
     * @param collectionId updates a collection
     * @returns job_id of update job
     */
    async updateCollection(collectionId: string) {
      const job_id = await this.createJob();
      // TODO whats going on here?
      const collection = await this.getCollectionById(collectionId);

      return job_id;
    },
    async deleteCollection(colId: string) {
      const deleteResponse = await Collections.delete({ coll_id: colId });
      return deleteResponse;
    },
    async getMVT(
      collId: string,
      z: number,
      x: number,
      y: number,
      extent = 4096,
      buffer = 64,
      name = "default"
    ) {
      if (extent < 1) throw new Error("Extent must be > 1");

      const buffer_fp = buffer * 1.0;
      const feature_table = "features_test";

      const mvt_tmpl = `WITH mvtgeom AS (\
      SELECT ST_AsMVTGeom(geom, 
        ST_TileEnvelope(
          ${z},${x},${y}), 
          extent => ${extent},  
          buffer => ${buffer}) 
        AS geom, properties \
        FROM ${feature_table} \
        WHERE geom 
          && ST_TileEnvelope(${z},${x},${y}, margin=> (${buffer_fp}/${extent})) \
        AND ft_collection = '${collId}') \
      SELECT ST_AsMVT(mvtgeom.*, '${name}') FROM mvtgeom;`;

      const mvt_resp = await Features.query(mvt_tmpl);

      return mvt_resp;
    },
    async patchAndGetDiff(patchPath: string) {
      console.log("trying", patchPath);
      const query =
        "COPY patch_features(feature_id, geom, properties, ft_collection) \
        FROM STDIN (FORMAT CSV, DELIMITER ';')";

      const copyQuery = pgcopy.from(query);
      const queryRunner = conn.createQueryRunner();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();

      return await pipeline(
        createReadStream(patchPath),
        pgConn.query(copyQuery)
      );
    },
    //
  } satisfies PostgresDB);

  fastify.addHook("onClose", async () => {
    console.log("stopping dbPlugin");
  });
};

export default fp(dbPlugin);
