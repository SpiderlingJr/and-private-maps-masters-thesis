import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import pgcopy from "pg-copy-streams";

import { pipeline } from "stream/promises";
import { createReadStream } from "fs";
import { DataSource, DeleteResult, In, UpdateResult } from "typeorm";
import { TmpFeatures, Features, PatchFeatures } from "src/entities/features.js";
import { Collections } from "src/entities/collections.js";
import { Jobs, JobState } from "src/entities/jobs.js";
import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner";
import { styleSchema } from "../schema/httpRequestSchemas.js";

/* TODO Consider path length behavior in DumpPoints when querying more than 1 
polygon
https://postgis.net/docs/ST_DumpPoints.html
*/
/** Result of a ST_DumpPoints query, also including feature id
 * References:
 * - https://postgis.net/docs/ST_DumpPoints.html
 * - https://postgis.net/docs/geometry_dump.html
 *
 * @example
 * {
 *  featid: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
 *  path: [0, 0],
 *  geom: "POINT(1 2)"
 * }
 *
 * {
 *  featid: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
 *  path: [0, 1],
 *  geom: "POINT(3 4)"
 * }
 *
 */
export interface GeometryDump {
  /** the uuid of the dumped feature
   *
   * @example
   * "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
   */
  featid: string;
  /** description of the geometry position in the dump
   * first position: index of the geometry (can be more than one)
   * second position: index of the point in the geometry
   *
   * @example
   * [0, 0] -> first geometry, first point
   * [0, 1] -> first geometry, second point
   * [1, 0] -> second geometry, first point
   */
  path: number[];
  /** the geometry as WKT string
   *
   * @example
   * "POINT(1 2)"
   * "LINESTRING(1 2, 3 4)"
   * "POLYGON((1 2, 3 4, 5 6, 1 2))"
   *
   */
  geom: string;
}
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
  /**
   * Streams contents of validated csv file to db
   * @param fpath
   */
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
  /** Patches features of a collection in db. Passed features and collection must already exist.
     * Calculates the difference between existing and patched features and returns the difference.
     *
     * First copies all features to a temporary table (patch_features) and calculates the Difference
     * between the Union and Intersection of both existing and patched features, using the postgis
     * ST_Difference, ST_Union and ST_Intersection functions. Then, the resulting multipolygon is
     * returned as a point cloud (ST_DumpPoints). Finally, the new features are updated in the db
     * and the temporary table entries are deleted.
     *
     * Passed features are assumed to be valid and must be formatted as csv with the following columns:
     * - feature_id: uuid (must already exist in db)
     * - geom:  Geometry in WKT format
     * - properties: properties as json, can be {}
     * - ft_collection, uuid of collection to which feature belongs
     *

     * @param patchPath path to csv file containing features to be patched
     * @returns diff between existing and patched features
     */
  patchAndGetDiff(patchPath: string): Promise<GeometryDump[]>;
}

/**
 *  Plugin handling database communication

 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const dbPlugin: FastifyPluginAsync = async (fastify) => {
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
        "COPY features(geom, properties, ft_collection) FROM STDIN (FORMAT CSV, DELIMITER ';')";
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
      try {
        const coll = await Collections.findOneOrFail({
          where: { coll_id: colId },
        });
        return coll;
      } catch (err: any) {
        const errAsJson = JSON.parse(JSON.stringify(err));
        if (errAsJson.code === "22P02") {
          throw new Error("22P02", { cause: "Invalid Syntax for UUID" });
        }
        if (errAsJson.message.startsWith("Could not find any entity of type")) {
          throw new Error("404", { cause: "No such collection" });
        }
        throw err;
      }
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
     * ! Whats going on here?
     * @param collectionId updates a collection
     * @returns job_id of update job
     */
    async updateCollection(collectionId: string) {
      // TODO: What is this
      const job_id = await this.createJob();

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

      const bufferFloat = buffer * 1.0;
      const featureTable = "features";

      const mvt_tmpl = `WITH mvtgeom AS (\
      SELECT ST_AsMVTGeom(
       ST_Transform(ST_SetSRID(geom,4326), 3857), 
        ST_TileEnvelope(
          ${z},${x},${y}), 
          extent => ${extent},  
          buffer => ${buffer}) 
        AS geom, properties \
        FROM ${featureTable} \
        WHERE geom 
          && ST_TileEnvelope(0,0,0, margin=> (${bufferFloat}/${extent})) \
        AND ft_collection = '${collId}') \
      SELECT ST_AsMVT(mvtgeom.*, '${name}') FROM mvtgeom;`;

      fastify.log.debug(`Queriying mvt: ${z}/${x}/${y}`);
      const mvtResponse = await Features.query(mvt_tmpl);
      fastify.log.debug(`Received: ${z}/${x}/${y}`);

      return mvtResponse;
    },
    async patchAndGetDiff(patchPath: string) {
      // Query to copy features from csv to db
      const copyQuery = pgcopy.from(
        "COPY patch_features(feature_id, geom, properties, ft_collection) \
      FROM STDIN (FORMAT CSV, DELIMITER ';')"
      );
      const queryRunner = conn.createQueryRunner();

      queryRunner.startTransaction();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();

      const copyTimer = fastify.performanceMeter.startTimer("copyStreamPatch");
      try {
        // Copies csv file to db
        await pipeline(createReadStream(patchPath), pgConn.query(copyQuery));
        copyTimer.stop(true);
      } catch (e) {
        copyTimer.stop(false);
        fastify.log.error(e);
        throw e;
      }
      // TODO assert that all features in patch data are contained in existing features
      // ? else abort transaction

      // Query to get difference between existing and patched features
      const deltaPolyQuery = `
        SELECT tmp2.featid as featId, 
        (ST_DumpPoints(diffpoly)).path as path, 
        ST_AsText(ST_Transform(ST_SetSRID((ST_DumpPoints(diffpoly)).geom, 4326),3857))
            as geom FROM (
            SELECT 
              featId,
              St_AsText(ST_Difference(g_union, g_inter)) as diffpoly         
            FROM ( 
              SELECT 
                og.feature_id as featId,
                ST_Union(og.geom, pg.geom) as g_union, 
                ST_Intersection(og.geom, pg.geom) as g_inter
              FROM features as og JOIN patch_features as pg
              ON og.feature_id = pg.feature_id
            ) as tmp
          ) as tmp2
        `;

      const deltaPolyTimer =
        fastify.performanceMeter.startTimer("deltaPolyQuery");
      let featIds;
      /* Let db calculate difference between existing and patched features
      and return as geometry dump */
      try {
        const deltaPolys: GeometryDump[] = await queryRunner.query(
          deltaPolyQuery
        );
        deltaPolyTimer.stop(true);

        featIds = deltaPolys.map((d) => d.featid);

        if (!deltaPolys) {
          // TODO how does this handle if patch set is identical
          throw new Error("Error while calculating delta polygons");
        }

        const updateResult = await queryRunner.query(
          `UPDATE features 
            SET geom = patch_features.geom, 
                properties = patch_features.properties, 
                ft_collection = patch_features.ft_collection
          FROM patch_features
          WHERE features.feature_id = patch_features.feature_id`
        );
        if (!updateResult) {
          // TODO construct a scenario where this happens
          throw new Error(
            "Error while updating features: could not receive update result"
          );
        }
        await queryRunner.commitTransaction();
        return deltaPolys;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        fastify.log.error(
          "Error while trying to receive delta poly, rolling back transaction\n",
          err
        );
        deltaPolyTimer.stop(false);
        throw err;
      } finally {
        // delete feature from patch table
        await queryRunner.release();
        if (featIds) {
          await PatchFeatures.delete({ feature_id: In(featIds) }).then(
            (res) => {
              fastify.log.debug(
                `Deleted ${res.affected} features from patch_features`
              );
            }
          );
        }
      }
    },
  } satisfies PostgresDB);

  fastify.addHook("onClose", async () => {
    console.log("stopping dbPlugin");
  });
};

export default fp(dbPlugin);
