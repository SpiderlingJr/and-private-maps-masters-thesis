/**
 * This plugin implements logic for finding and evicting tiles from cache that
 * are stale as a result of a change in the database.
 */
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
  findMvtParents,
  parsePolyPoints,
  rasterize,
} from "./eviction/evictionUtil";

// TODO make max zoom env config
const MAX_ZOOM = 18;
declare module "fastify" {
  interface FastifyInstance {
    evictor: Evictor;
  }
}
export enum EvictionStrategy {
  BOXCUT_BO,
  BOXCUT_BOTTOM_UP,
  BOXCUT_TD,
  BOXCUT_TOP_DOWN,
  RASTER_BO,
  RASTER_BOTTOM_UP,
}
interface Evictor {
  /**
   * Method to evict tiles from cache that are stale due to a change in the database
   * @param deltaPolys A set of polygons representing the changes in the database
   */
  evict(collectionId: string): Promise<void>;
}
/**
 *
 * @param fastify
 * @param options strategy: The eviction strategy to use
 *  - boxcutBO: Naive approach using bounding boxes with a bottom up approach
 *  - boxcutTD: Naive approach using bounding boxes with a top down approach
 *  - bresenhamBO: Bresenham's line algorithm with a bottom up approach
 *
 */
const cacheEvictionPlugin: FastifyPluginAsync<{
  strategy?: EvictionStrategy;
}> = async (fastify, options) => {
  // Deepest considered zoom level
  const maxZoom = process.env.MAX_ZOOM ? parseInt(process.env.MAX_ZOOM) : 9;

  fastify.log.info(
    `Using cache eviction strategy: ${options.strategy} with max zoom ${maxZoom}`
  );
  async function evictEntries(mvts: Set<string>) {
    try {
      for (const k of mvts) {
        await fastify.cache.del(k);
      }
    } catch (e) {
      fastify.log.error("Error during eviction:", e);
      throw e;
    }
  }
  /* Pseudo 
      N = tables.patch_features(collection_id)
      E = tables.features(collection_id)
      evict(N, E)
        -> evictStrat1 =: boxcut
        -> evictStrat2 =: raster
        -> evictStrat3 =: cluster search
      */
  switch (options.strategy) {
    case EvictionStrategy.RASTER_BOTTOM_UP | EvictionStrategy.RASTER_BO:
      fastify.log.info("Using Eviciton Strategy: Bresenham Bottom Up");
      fastify.decorate("evictor", {
        /** Bresenham bottom up eviction strategy
         *
         * @param collectionId
         * @param maxZoom
         * @returns
         */
        async evict(collectionId: string) {
          /* Get difference between patch and existing data
          - existing data resides in table 'features'
          - patch data resides in table 'patch_features'
          */
          const deltaPolys = await fastify.db.getPatchDelta(collectionId);
          fastify.log.debug("Delta Polys:", deltaPolys);
          const points = parsePolyPoints(deltaPolys);
          fastify.log.debug("Delta Poly Points:", points);

          const mvts = rasterize(points, maxZoom);

          // TODO fill holes in mvt raster

          // Set of MVTs formatted as string in the form of z/x/y
          // TODO remove fmtMvts, use mvtStrings instead
          const fmtMvts = new Set<string>();
          const mvtStrings = new Set<string>();
          for (const m of mvts) {
            fmtMvts.add(`${m[0]}/${m[1]}/${m[2]}`);
          }
          for (const m of mvts) {
            mvtStrings.add(`${m[0]}/${m[1]}/${m[2]}`);
          }
          const parentMvtStrings = findMvtParents(maxZoom, fmtMvts);
          if (fastify.log.level === "trace") {
            const maxTrace = 50;
            fastify.log.trace("MVTs");
            let i = 0;
            mvts.forEach((m) => {
              i++;
              fastify.log.trace(`${m[0]}/${m[1]}/${m[2]}`);
              if (i >= maxTrace) {
                fastify.log.trace("...");
                return;
              }
            });
            let j = 0;
            fastify.log.debug(
              "Evicting",
              parentMvtStrings.size,
              "parent tiles"
            );
            parentMvtStrings.forEach((m) => {
              j++;
              fastify.log.debug(m);
              if (j >= maxTrace) {
                fastify.log.debug("...");
                return;
              }
            });
          }

          fastify.log.debug("Evicting", mvtStrings.size, "tiles");
          mvtStrings.forEach((m) => {
            fastify.log.debug(m);
          });
          fastify.log.debug("Evicting", parentMvtStrings.size, "parent tiles");
          parentMvtStrings.forEach((m) => {
            fastify.log.debug(m);
          });

          await evictEntries(parentMvtStrings);
          await evictEntries(mvtStrings);
          return;
        },
      } satisfies Evictor);
      break;
    default:
      throw new Error("Invalid eviction strategy");
  }
};

export default fp(cacheEvictionPlugin);
