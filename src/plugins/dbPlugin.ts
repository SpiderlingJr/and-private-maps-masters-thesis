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
import {
  MVT1,
  MVT2,
  MVT3,
  MVT4,
  MVT5,
  MVT6,
  MVT7,
  MVT8,
  MVT9,
  MVT10,
  MVT11,
  MVT12,
  MVT13,
  MVT14,
} from "src/entities/mvts.js";
//@ts-expect-error no types
import vt from "vector-tile";
import Protobuf from "pbf";
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

interface ClusteredTiles {
  /** Cluster number */
  cluster_id: number;
  /** Vector tile x coordinate */
  tile_x: number;
  /** Vector tile y coordinate */
  tile_y: number;
}
declare module "fastify" {
  interface FastifyInstance {
    db: PostgresDB;
  }
}
interface PostgresDB {
  /*
   * Collection operations *
   */
  createCollection(): Promise<string>;
  updateCollection(collectionId: string): Promise<string>;
  deleteCollection(collectionId: string): Promise<DeleteResult>;
  /** Deletes entries from patch_features table by collection id. Does not
   *  affect features table.
   *
   * @param collectionId uuid of collection to be deleted
   */
  deletePatchCollection(collectionId: string): Promise<DeleteResult>;
  getCollectionById(collId: string): Promise<Collections | null>;
  listCollections(): Promise<Collections[]>;
  setStyle(
    collId: string,
    Style: { minZoom: number; maxZoom: number }
  ): Promise<UpdateResult>;
  getCollectionZoomLevel(
    collId: string
  ): Promise<{ minZoom: number; maxZoom: number }>;
  /** Applies patch by updating contents from patch_features to features table
   *
   * @param collectionId uuid of collection to be patched
   */
  patchCollection(collectionId: string): Promise<unknown>;
  /** Compares features in the tables features and patch_features and returns
   * their difference, as a point cloud (ST_DumpPoints).
   *
   * Calculates the Difference between the Union and Intersection of both
   * existing and patched features, using the postgis ST_Difference, ST_Union
   * and ST_Intersection functions. Then, the resulting multipolygon is
   * returned as a point cloud (ST_DumpPoints).
   *
   * Assumes that all entries in table 'patch_features' are valid and exist in
   * table 'features', analogous with the collection id, which must exist in
   * both tables.
   *
   * @param collectionId uuid of collection to be patched
   * @returns diff between existing and patched features as GeometryDump[]
   */
  getPatchDelta(collectionId: string): Promise<GeometryDump[]>;
  /*
   * Feature operations *
   */
  /** Streams contents of csv file to features table.
   *
   * Contents are assumed to be valid and must be formatted as colon-seperated
   * csv containing only following columns:
   * - geom: Geometry in WKT format (POINT, LINESTRING, POLYGON)
   * - properties: properties as json, can be {}
   * - ft_collection, uuid of collection to which feature belongs
   *
   * @example
   * "POINT(1 2)";{"name": "foo"};"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
   * "LINESTRING(1 2, 3 4)";{};"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
   *
   * @param file path to csv file
   */
  copyToFeatures(collectionPath: string): Promise<unknown>;
  /** Streams contents of csv file to patch_features table
   *
   * Contents are assumed to be valid and must be formatted as colon-seperated
   * csv containing only following columns:
   * - feature_id: uuid (must already exist in db)
   * - geom: Geometry in WKT format (POINT, LINESTRING, POLYGON)
   * - properties: properties as json, can be {}
   * - ft_collection, uuid of collection to which feature belongs
   *
   * @param file path to csv file
   */
  copyToPatchFeatures(patchPath: string): Promise<unknown>;
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
    name?: string,
    debug?: boolean
  ): Promise<MVTResponse[]>;
  /*
   * Job operations *
   */
  createJob(): Promise<string>;
  updateJob(
    jobId: string,
    state: JobState,
    colId?: string,
    note?: string
  ): Promise<UpdateResult | undefined>;
  getJobById(jobId: string): Promise<Jobs | null>;
  /** Compares the entries in the tables features and patch_features of a given
   * collection and finds corresponding MVTs that need to be invalidated, using
   * the following strategy:
   * 1. Get features from patch_features table (N)
   * 2. Get features from features table (E)
   * 3. Build the bounding box of N and E
   * 4. Build the union of N and E =: U
   * 5. Run over all MVTs in passed mvtTable and check if they intersect with U
   * 6. Return all intersecting MVTs in form of z/x/y
   *
   * @param collId: uuid of updated collection, must exist in features and
   *  patch_features table
   * @param zoomLevel: zoom level of mvt tiles to be evicted
   * @returns set of mvt strings in form of z/x/y
   */
  getPatchedMVTStringsBoxcut(
    collId: string,
    zoomLevel: number
  ): Promise<Set<string>>;
  /** Same as Boxcut, but uses generate_series to generate tile coordinates in
   * union box, instead of intersecting with all tiles in mvtTable.
   *
   * @param collId
   * @param zoomLevel
   */
  getPatchedMVTStringsBoxcutIter(
    collId: string,
    zoomLevel: number
  ): Promise<Set<string>>;
  /** Finds the exact vector tile set to evict after a patch, with no excess
   * tiles. Trades performance for accuracy.
   *
   * Strategy:
   * 1. Get features from patch_features table (N)
   * 2. Get features from features table (E)
   * 3. Build the union of N and E =: U
   * 4. Build the intersection of N and E =: I
   * 5. Build the difference of U and I =: D
   * 6. Run over all MVTs in passed mvtTable and check if they intersect with D
   * 7. Return all intersecting MVTs in form of z/x/y
   *
   * Uses the following postgis functions:
   * ST_UNION, ST_INTERSECTION, ST_DIFFERENCE
   *
   * @param collId: uuid of updated collection, must exist in features and
   * patch_features table
   * @param maxZoom: zoom level of mvt tiles to be evicted
   * @returns set of mvt strings in form of z/x/y
   */
  getPatchedMVTStringsExact(
    collId: string,
    maxZoom: number
  ): Promise<Set<string>>;
  /** Finds vector tile set to evict after a patch. This method tries to find
   * clusters in the change set and evicts the bounding boxes of found clusters.
   *
   * Strategy:
   * 1. Get features from patch_features table (N)
   * 2. Get features from features table (E)
   * 3. Build the union of N and E =: U
   * 4. Build the intersection of N and E =: I
   * 5. Build the difference of U and I =: D := change set
   * 6. Run a DBSCAN clustering algorithm on D
   * 7. For each cluster, build the bounding box
   * 8. Find the vector tiles that the bounding boxes reside in by mapping the
   * upper left and lower right corner of the bounding box to their corresponding
   * vector tiles, then use generate_series to interpolate all tiles in between.
   * 9. Return all intersecting MVTs in form of z/x/y
   *
   * Outlier clusters are treated as their own seperate clusters.
   *
   * @param collId: uuid of updated collection, must exist in features and
   * patch_features table
   * @param zoomLevel: zoom level of mvt tiles to be evicted
   * @returns set of mvt strings in form of z/x/y
   */
  getPatchedMVTStringsClusterBoxcut(
    collectionId: string,
    maxZoom: number
  ): Promise<Set<string>>;
  /** Same as getPatchedMVTStringsClusterBoxcut, but uses lateral joins in the
   * dump step to speed up the process.
   *
   * @param collectionId
   * @param maxZoom
   * @returns set of mvt strings in form of z/x/y
   */
  getPatchedMVTStringsClusterBoxcutLateral(
    collectionId: string,
    maxZoom: number
  ): Promise<Set<string>>;
  /** Cluster Strategy that applies exact logic on clusters.
   *
   * @param collectionId
   * @param maxZoom
   * @returns set of mvt strings in form of z/x/y
   */
  getPatchedMVTStringsClusterExact(
    collectionId: string,
    maxZoom: number
  ): Promise<Set<string>>;
  calcCollectionDelta(
    coll1: string,
    coll2: string,
    newColl: string
  ): Promise<any>;
  /** Loads a set of tiles into cache by calling getMVT for each tile.
   *
   * @param collectionId uuid of collection to which tiles belong
   * @param droppedTiles
   *
   * @returns number of tiles loaded into cache
   */
  fillCache(
    collectionId: string,
    tiles: Set<string>,
    maxReload?: number
  ): Promise<number>;
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
        //logging: ["query", "error"],
        port: Number(process.env.POSTGRES_EXPOSE),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [
          Features,
          Collections,
          Jobs,
          TmpFeatures,
          PatchFeatures,
          MVT1,
          MVT2,
          MVT3,
          MVT4,
          MVT5,
          MVT6,
          MVT7,
          MVT8,
          MVT9,
          MVT10,
          MVT11,
          MVT12,
          MVT13,
          MVT14,
        ],
        synchronize: true,
      });

      return conn.initialize();
    } catch (err) {
      throw new Error("Error while trying to connect to database:\n" + err);
    }
  }
  /** Logs a vector tile as geojson to console, pastable to geojson.io
   *
   * @param mvtBuffer vector tile buffer as received from postgis
   * @param {Object} options logging options
   * @param {string} options.name name of the vector tile (default: "default")
   * @param {string} options.collId collection id of the vector tile (default: "anyCollection")
   * @param {number} options.x x coordinate of the vector tile
   * @param {number} options.y y coordinate of the vector tile
   * @param {number} options.z z coordinate of the vector tile
   */
  function logMvtAsGeojson(
    mvtBuffer: Buffer,
    {
      name = "default",
      collId = "anyCollection",
      x,
      y,
      z,
    }: {
      name?: string;
      collId?: string;
      x: number;
      y: number;
      z: number;
    }
  ) {
    try {
      const tile = new vt.VectorTile(new Protobuf(mvtBuffer));
      const layers = [name];

      const collection = {
        type: "FeatureCollection",
        features: [] as any[],
      };
      layers.forEach(function (layerID) {
        const layer = tile.layers[layerID];
        if (layer) {
          for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i).toGeoJSON(x, y, z);
            if (layers.length > 1) feature.properties.vt_layer = layerID;
            collection.features.push(feature);
          }
        }
      });
      console.log(`${collId}: ${z}/${x}/${y}`);
      console.dir(JSON.stringify(collection));
    } catch (e) {
      console.error(e);
    }
  }
  function isJobState(value: string): value is JobState {
    return ["pending", "finished", "error"].includes(value);
  }
  async function copy(file: string, copyQuery: string) {
    try {
      const query = pgcopy.from(copyQuery);
      const queryRunner = conn.createQueryRunner();
      const pgConn = await (<PostgresQueryRunner>queryRunner).connect();
      await pipeline(createReadStream(file), pgConn.query(query));
    } catch (e) {
      throw new Error("Error while copying to db:\n" + e);
    }
    //
  }
  conn = await connectDB();

  fastify.decorate("db", {
    async createCollection() {
      const coll = Collections.create({});
      await coll.save();
      return coll.coll_id;
    },
    async listCollections() {
      const colls = await Collections.find();
      return colls;
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
    async copyToFeatures(file: string) {
      const copyQuery = `COPY features(geom, properties, ft_collection) 
          FROM STDIN (FORMAT CSV, DELIMITER ';')`;
      const copyTimer = fastify.performanceMeter.startTimer("copyToFeatures");

      try {
        await copy(file, copyQuery);
        copyTimer.stop(true);
      } catch (e) {
        copyTimer.stop(false);
        fastify.log.error(e);
        throw e;
      }
    },
    async copyToPatchFeatures(file: string) {
      const copyQuery = `COPY patch_features(feature_id, geom, properties, ft_collection) 
          FROM STDIN (FORMAT CSV, DELIMITER ';')`;
      const copyTimer = fastify.performanceMeter.startTimer(
        "copyToPatchFeatures"
      );
      try {
        await copy(file, copyQuery);
        copyTimer.stop(true);
      } catch (e) {
        copyTimer.stop(false);
        fastify.log.error(e);
        throw e;
      }
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
    async deletePatchCollection(colId: string) {
      const deleteResponse = await conn
        .createQueryBuilder()
        .delete()
        .from(PatchFeatures)
        .where("ft_collection = :id", { id: colId })
        .execute();
      return deleteResponse;
    },
    async getMVT(
      collId: string,
      z: number,
      x: number,
      y: number,
      extent = 4096,
      buffer = 64,
      name = "default",
      debug = false
    ) {
      if (extent < 1) throw new Error("Extent must be > 1");

      const bufferFloat = buffer * 1.0;
      const featureTable = "features";

      /* 
      TODO Alternative: content-type json ermöglichen
      rückgabe nicht als mvtgeom sondern feature-collection (=: content in dieser mvt)
      
      TODO fastify content-type helper anschauen
      */
      const mvt_tmpl = `
        WITH mvtgeom AS (\
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
        SELECT ST_AsMVT(mvtgeom.*, '${name}') FROM mvtgeom;
      `;

      const mvtResponse = await Features.query(mvt_tmpl);

      if (debug) {
        logMvtAsGeojson(mvtResponse[0].st_asmvt, {
          collId: collId,
          x: x,
          y: y,
          z: z,
        });
      }
      fastify.log.trace(`Received: ${z}/${x}/${y}`);

      return mvtResponse;
    },
    async fillCache(collId: string, tiles: Set<string>, maxReload = 1000) {
      const cache = fastify.cache;
      let i = 0;
      const numTiles = tiles.size;
      //const tenPercent = Math.floor(numTiles / 10);
      for (const tile of tiles) {
        i++;
        /*
        if (i % tenPercent === 0) {
          fastify.log.info(
            `Filling cache progress: ${Math.floor((i / numTiles) * 100)}%`
          );
        }*/
        const [z, x, y] = tile.split("/").map((x) => parseInt(x));
        const mvt = await this.getMVT(collId, z, x, y);
        await cache.set(tile, mvt[0].st_asmvt);
        if (i >= maxReload) {
          fastify.log.info(`Reached reload limit of ${maxReload} tiles.`);
          break;
        }
      }
      return i;
    },
    async patchCollection(collectionId: string) {
      fastify.log.debug("Patching collection", collectionId);
      const queryRunner = conn.createQueryRunner();
      const updateResult = await queryRunner.query(
        `UPDATE features 
            SET geom = patch_features.geom, 
                properties = patch_features.properties
          FROM patch_features
          WHERE 
            patch_features.ft_collection = '${collectionId}' 
          AND  
            features.feature_id = patch_features.feature_id`
      );
      if (!updateResult) {
        throw new Error(
          "Error while updating features: could not receive update result"
        );
      }
      return updateResult;
    },
    async getPatchDelta(collectionId: string) {
      const queryRunner = conn.createQueryRunner();
      const deltaPolys: GeometryDump[] = await queryRunner.query(
        `SELECT 
          tmp2.featid AS featId, 
          (ST_DumpPoints(diffpoly)).path AS path, 
          ST_AsText(
            ST_Transform(
              ST_SetSRID(
                (ST_DumpPoints(diffpoly)).geom,
              4326),
            3857)
          ) AS geom 
          FROM (
            SELECT 
              featId,
              St_AsText(ST_Difference(g_union, g_inter)) AS diffpoly         
            FROM ( 
              SELECT 
                og.feature_id AS featId,
                ST_Union(og.geom, pg.geom) AS g_union, 
                ST_Intersection(og.geom, pg.geom) AS g_inter
              FROM 
                features AS og 
              JOIN 
                patch_features AS pg
              ON 
                og.feature_id = pg.feature_id
              WHERE 
                og.ft_collection = '${collectionId}'
            ) AS tmp
          ) AS tmp2
        `
      );

      if (!deltaPolys) {
        // TODO how does this handle if patch set is identical
        throw new Error("Error while calculating delta polygons");
      }
      return deltaPolys;
    },
    async getPatchedMVTStringsBoxcut(collId: string, zoomLevel: number) {
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const mvtResult = await queryRunner.query(
        `
          WITH
          E AS (
            SELECT ST_Envelope(ST_Union(geom)) as geom
            FROM features
            WHERE ft_collection = '${collId}'
          ),
          N AS (
            SELECT ST_Envelope(ST_Union(geom)) as geom
            FROM patch_features
            WHERE ft_collection = '${collId}'
          )
          SELECT x, y --, union_geom
          FROM (
            -- Union Box
            SELECT ST_Union(E.geom, N.geom) as union_geom
            FROM E, N
          ) as uni JOIN mvt${zoomLevel}
          ON ST_Intersects(ST_SetSRID(union_geom, 4326), mvt${zoomLevel}.geom)
          ORDER BY x asc, y asc
      `
      );
      // Build MVTStrings from query Result
      for (const row of mvtResult) {
        const { x, y } = row;
        mvtStrings.add(`${zoomLevel}/${x}/${y}`);
      }
      return mvtStrings;
    },
    async getPatchedMVTStringsBoxcutIter(collId: string, zoomLevel: number) {
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const mvtResult = await queryRunner.query(
        `
        WITH
          E AS (
            SELECT ST_Union(geom) as geom
            FROM features
            WHERE ft_collection = '${collId}'
          ),
          N AS (
            SELECT ST_Union(geom) as geom
            FROM patch_features
            WHERE ft_collection = '${collId}'
          ),
          U AS (
            SELECT
                ST_Envelope (ST_Transform (ST_Union (E.geom, N.geom), 3857)) as unibox
            FROM
                E,
                N
          ),
          BBOX AS (
              SELECT
                  epsg3857_to_vector_tile (
                      ST_Xmin (U.unibox),
                      ST_Ymax (U.unibox),
                      ${zoomLevel}
                  ) as top_left,
                  epsg3857_to_vector_tile (
                      ST_Xmax (U.unibox),
                      ST_Ymin (U.unibox),
                      ${zoomLevel}
                  ) as bot_right
              FROM
                  U
          ),
          x_series AS (
              SELECT
                  generate_series((top_left).tile_x, (bot_right).tile_x) AS tile_x
              FROM
                  BBOX
          ),
          y_series AS (
              SELECT
                  generate_series((top_left).tile_y, (bot_right).tile_y) AS tile_y
              FROM
                  BBOX
          )
          SELECT
              xs.tile_x as x,
              ys.tile_y as y
          FROM
              x_series AS xs
              JOIN y_series AS ys ON TRUE
      `
      );
      // Build MVTStrings from query Result
      for (const row of mvtResult) {
        const { x, y } = row;
        mvtStrings.add(`${zoomLevel}/${x}/${y}`);
      }
      return mvtStrings;
    },
    async getPatchedMVTStringsExact(collId: string, zoomLevel: number) {
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const deltaMvts = await queryRunner.query(
        `
        WITH
          E AS (
            SELECT 
              ST_Union(geom) as geom
            FROM 
              features
            WHERE 
              ft_collection = '${collId}'
          ),
          N AS (
            SELECT 
              ST_Union(geom) as geom
            FROM 
              patch_features
            WHERE 
              ft_collection = '${collId}'
          ),
          U AS (
            SELECT 
              ST_Union(E.geom, N.geom) AS geom
            FROM 
              E, 
              N
          ),
          I AS (
            SELECT 
              ST_Intersection(E.geom, N.geom) AS geom
            FROM 
              E, 
              N
          ),
          D AS (
            SELECT 
              ST_Difference(U.geom, I.geom) AS geom,
              ST_Transform(ST_Envelope(ST_Difference(U.geom, I.geom)),3857) as bbox
            FROM U, I
          ),
          BBOX AS (
            SELECT
            epsg3857_to_vector_tile (
              ST_Xmin(D.bbox),
              ST_Ymax(D.bbox),
              ${zoomLevel}
              ) as top_left,
            epsg3857_to_vector_tile (
              ST_Xmax(D.bbox),
              ST_Ymin(D.bbox),
              ${zoomLevel}
              ) as bot_right
            FROM D
          )
          SELECT 
            x, y
          FROM 
            D 
          JOIN 
            BBOX 
            ON true
          JOIN 
            mvt${zoomLevel}
          ON 
            mvt${zoomLevel}.x BETWEEN (top_left).tile_x AND (bot_right).tile_x 
          AND 
            mvt${zoomLevel}.y BETWEEN (top_left).tile_y AND (bot_right).tile_y
          AND 
            ST_Intersects(ST_SetSrid(D.geom, 4326), mvt${zoomLevel}.geom)
          ORDER BY 
            x ASC, y ASC	
      `
      );
      // Build MVTStrings from query Result
      for (const row of deltaMvts) {
        const { x, y } = row;
        mvtStrings.add(`${zoomLevel}/${x}/${y}`);
      }
      return mvtStrings;
    },
    async getPatchedMVTStringsClusterBoxcut(collId: string, zoomLevel: number) {
      const epsZ = 128 / Math.pow(2, zoomLevel);
      fastify.log.metric({
        name: "epsZ",
        value: epsZ,
      });
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const mvtResult: ClusteredTiles[] = await queryRunner.query(
        `
        WITH
            E AS (
                SELECT
                    ST_Union (geom) as geom
                FROM
                    features
                WHERE
                    ft_collection = '${collId}'
            ),
            N AS (
                SELECT
                    ST_Union (geom) as geom
                FROM
                    patch_features
                WHERE
                    ft_collection = '${collId}'
            ),
            U AS (
                SELECT
                    ST_Union (E.geom, N.geom) as geom
                FROM
                    E,
                    N
            ),
            I AS (
                SELECT
                    ST_Intersection (E.geom, N.geom) as geom
                FROM
                    E,
                    N
            ),
            D AS (
                SELECT
                    --ST_Difference (U.geom, I.geom) as geom
                    (ST_Dump(ST_Difference (U.geom, I.geom))).geom
                FROM
                    U,
                    I
            ),
            /*
            Build clusters from change set
            */
            clusters AS (
                SELECT
                    CASE
                        WHEN cluster_id IS NULL THEN row_number() over ()
                        ELSE cluster_id
                    END as cluster_id,
                    ST_Transform (ST_Envelope (ST_Collect (geom)), 3857) AS bbox
                FROM
                    (
                        SELECT
                            ST_ClusterDBSCAN (geom, eps := ${epsZ}, minpoints := 2) over () AS cluster_id,
                            geom
                        FROM
                            D
                    ) subquery
                GROUP BY
                    cluster_id,
                    CASE
                        WHEN cluster_id IS NULL THEN geom
                    END
            ),
            /* 
            Project cluster BBox to vector tile coordinates
            */
            tile_coords AS (
                SELECT
                    cluster_id,
                    epsg3857_to_vector_tile (
                        ST_Xmin (clusters.bbox),
                        ST_Ymax (clusters.bbox),
                        ${zoomLevel}
                    ) AS top_left,
                    epsg3857_to_vector_tile (
                        ST_Xmax (clusters.bbox),
                        ST_Ymin (clusters.bbox),
                        ${zoomLevel}
                    ) AS bot_right
                FROM
                    clusters
            ),
            /*
            Interpolate box vector tile coordinates
            */
            x_series AS (
                SELECT
                    cluster_id,
                    generate_series((top_left).tile_x, (bot_right).tile_x) AS tile_x
                FROM
                    tile_coords
            ),
            y_series AS (
                SELECT
                    cluster_id,
                    generate_series((top_left).tile_y, (bot_right).tile_y) AS tile_y
                FROM
                    tile_coords
            )
            /*
            Retrieve cluster vector tiles
            */
        SELECT
            xs.cluster_id,
            xs.tile_x,
            ys.tile_y
        FROM
            x_series AS xs
            JOIN y_series AS ys ON xs.cluster_id = ys.cluster_id;
        `
      );
      fastify.log.info("MVT Cluster Result:", mvtResult);
      // Build MVTStrings from query Result
      for (const row of mvtResult) {
        const { cluster_id, tile_x, tile_y } = row;
        mvtStrings.add(`${zoomLevel}/${tile_x}/${tile_y}`);
      }
      return mvtStrings;
    },
    async getPatchedMVTStringsClusterBoxcutLateral(
      collId: string,
      zoomLevel: number
    ) {
      const epsZ = 128 / Math.pow(2, zoomLevel);
      fastify.log.metric({
        name: "epsZ",
        value: epsZ,
      });
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const mvtResult: ClusteredTiles[] = await queryRunner.query(
        `
        WITH
            E AS (
                SELECT
                    ST_Union (geom) as geom
                FROM
                    features
                WHERE
                    ft_collection = '${collId}'
            ),
            N AS (
                SELECT
                    ST_Union (geom) as geom
                FROM
                    patch_features
                WHERE
                    ft_collection = '${collId}'
            ),
            U AS (
                SELECT
                    ST_Union (E.geom, N.geom) as geom
                FROM
                    E,
                    N
            ),
            I AS (
                SELECT
                    ST_Intersection (E.geom, N.geom) as geom
                FROM
                    E,
                    N
            ),
            D AS (
                SELECT
                    ST_Difference (U.geom, I.geom) as geom
                FROM
                    U,
                    I
            ),
            /*
            Build clusters from change set
            */
            clusters AS (
              SELECT
                CASE
                  WHEN cluster_id IS NULL THEN row_number() over ()
                  ELSE cluster_id
                END as cluster_id,
                ST_Transform (ST_Envelope (ST_Collect (geom)), 3857) AS bbox
              FROM
                (
                  SELECT
                    dump.geom, 
                    ST_ClusterDBSCAN (dump.geom, eps := ${epsZ}, minpoints := 2) over () AS cluster_id
                  FROM
                    D, 
                    LATERAL ST_Dump(D.geom) as dump
                ) subquery
              GROUP BY
                cluster_id,
                CASE
                  WHEN cluster_id IS NULL THEN geom
                END
            ),
            /* 
            Project cluster BBox to vector tile coordinates
            */
            tile_coords AS (
                SELECT
                    cluster_id,
                    epsg3857_to_vector_tile (
                        ST_Xmin (clusters.bbox),
                        ST_Ymax (clusters.bbox),
                        ${zoomLevel}
                    ) AS top_left,
                    epsg3857_to_vector_tile (
                        ST_Xmax (clusters.bbox),
                        ST_Ymin (clusters.bbox),
                        ${zoomLevel}
                    ) AS bot_right
                FROM
                    clusters
            ),
            /*
            Interpolate box vector tile coordinates
            */
            x_series AS (
                SELECT
                    cluster_id,
                    generate_series((top_left).tile_x, (bot_right).tile_x) AS tile_x
                FROM
                    tile_coords
            ),
            y_series AS (
                SELECT
                    cluster_id,
                    generate_series((top_left).tile_y, (bot_right).tile_y) AS tile_y
                FROM
                    tile_coords
            )
            /*
            Retrieve cluster vector tiles
            */
        SELECT
            xs.cluster_id,
            xs.tile_x,
            ys.tile_y
        FROM
            x_series AS xs
            JOIN y_series AS ys ON xs.cluster_id = ys.cluster_id;
        `
      );
      fastify.log.info("MVT Cluster Result:", mvtResult);
      // Build MVTStrings from query Result
      for (const row of mvtResult) {
        const { cluster_id, tile_x, tile_y } = row;
        mvtStrings.add(`${zoomLevel}/${tile_x}/${tile_y}`);
      }
      return mvtStrings;
    },
    async getPatchedMVTStringsClusterExact(collId: string, zoomLevel: number) {
      const epsZ = 128 / Math.pow(2, zoomLevel);
      fastify.log.metric({
        name: "epsZ",
        value: epsZ,
      });
      const mvtStrings = new Set<string>();
      const queryRunner = conn.createQueryRunner();
      const mvtResult: ClusteredTiles[] = await queryRunner.query(
        `
        WITH
          E AS (
              SELECT
                  ST_Union (geom) as geom
              FROM
                  features
              WHERE
                  ft_collection = '${collId}'
          ),
          N AS (
              SELECT
                  ST_Union (geom) as geom
              FROM
                  patch_features
              WHERE 
                  ft_collection = '${collId}'
          ),
          U AS (
              SELECT
                  ST_Union (E.geom, N.geom) as geom
              FROM
                  E,
                  N
          ),
          I AS (
              SELECT
                  ST_Intersection (E.geom, N.geom) as geom
              FROM
                  E,
                  N
          ),
          D AS (
              SELECT
                  (ST_Dump (ST_Difference (U.geom, I.geom))).geom
              FROM
                  U,
                  I
          ),
          /*
          Build clusters from change set
          */
          CLUSTERS AS (
              SELECT
                  CASE
                      WHEN cluster_id IS NULL THEN row_number() over ()
                      ELSE cluster_id
                  END as cluster_id,
                  ST_Transform (ST_Collect (geom), 3857) AS geom, -- The clustered geometry
                  ST_Transform (ST_Envelope (ST_Collect (geom)), 3857) AS bbox -- Bounding box of the cluster
              FROM
                  (
                      SELECT
                          ST_ClusterDBSCAN (geom, eps := ${epsZ}, minpoints := 2) over () AS cluster_id,
                          geom
                      FROM
                          D
                  ) subquery
              GROUP BY
                  cluster_id,
                  CASE
                      WHEN cluster_id IS NULL THEN geom
                  END
          ),
          /* 
          Project cluster BBox to vector tile coordinates
          */
          CLUSTER_BBOX_BOUNDS AS (
              SELECT
                  cluster_id
                  ,geom
                  ,CLUSTERS.bbox as bbox
                  ,epsg3857_to_vector_tile (
                      ST_Xmin (CLUSTERS.bbox),
                      ST_Ymax (CLUSTERS.bbox),
                      ${zoomLevel}
                  ) AS top_left
                  ,epsg3857_to_vector_tile (
                      ST_Xmax (CLUSTERS.bbox),
                      ST_Ymin (CLUSTERS.bbox),
                      ${zoomLevel}
                  ) AS bot_right
              FROM
                  CLUSTERS
          )
        SELECT
          --CLUSTER_BBOX_BOUNDS.cluster_id,
          distinct
          mvt_prefab.x AS tile_x,
          mvt_prefab.y AS tile_y
        FROM
          CLUSTER_BBOX_BOUNDS
        JOIN
          mvt${zoomLevel} as mvt_prefab
        ON 
          mvt_prefab.x BETWEEN (CLUSTER_BBOX_BOUNDS.top_left).tile_x AND (CLUSTER_BBOX_BOUNDS.bot_right).tile_x
        AND 
          mvt_prefab.y BETWEEN (CLUSTER_BBOX_BOUNDS.top_left).tile_y AND (CLUSTER_BBOX_BOUNDS.bot_right).tile_y
        AND 
          ST_Intersects(ST_Transform(ST_SetSRID(CLUSTER_BBOX_BOUNDS.geom, 3857), 4326), mvt_prefab.geom)
        ORDER BY
          tile_x ASC,
          tile_y ASC;
        `
      );
      //fastify.log.info(`MVT Cluster Result: ${JSON.stringify(mvtResult)}`);
      // Build MVTStrings from query Result
      for (const row of mvtResult) {
        const { tile_x, tile_y } = row;
        mvtStrings.add(`${zoomLevel}/${tile_x}/${tile_y}`);
      }
      return mvtStrings;
    },
    async calcCollectionDelta(coll1: string, coll2: string, newColl: string) {
      const queryRunner = conn.createQueryRunner();
      const delta = await queryRunner.query(
        `
        WITH
        E AS (
          SELECT ST_Union(geom) as geom
          FROM features
          WHERE ft_collection = '${coll1}'
        ),
        N AS (
          SELECT ST_Union(geom) as geom
          FROM features
          WHERE ft_collection = '${coll2}'
        ),
        U AS (
          SELECT ST_Union(E.geom, N.geom) as geom
          FROM E, N
        ),
        I AS (
          SELECT ST_Intersection(E.geom, N.geom) as geom
          FROM E, N
        ),
        D AS (
          SELECT ST_Difference(U.geom, I.geom) as geom
          FROM U, I
        )
        INSERT INTO features (geom, ft_collection, properties)
        SELECT 
            D.geom, 
            '${newColl}', 
            jsonb_build_object(
              'is', 'delta',
              'coll1', '${coll1}', 
              'coll2', '${coll2}'
              )
        FROM D;
      `
      );
      return delta;
    },
  } satisfies PostgresDB);

  fastify.addHook("onClose", async () => {
    console.log("stopping dbPlugin");
  });
};

export default fp(dbPlugin);
