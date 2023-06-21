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
const MAX_TRACE = 20;
const DEFAULT_MAX_ZOOM = 9;
declare module "fastify" {
  interface FastifyInstance {
    evictor: Evictor;
  }
}
export enum EvictionStrategy {
  BOXCUT_BO = "BOXCUT_BO",
  BOXCUT_BOTTOM_UP = "BOXCUT_BOTTOM_UP",
  BOXCUT_TD = "BOXCUT_TD",
  BOXCUT_TOP_DOWN = "BOXCUT_TOP_DOWN",
  RASTER_BO = "RASTER_BO",
  RASTER_BOTTOM_UP = "RASTER_BOTTOM_UP",
  EXACT = "EXACT",
  CLUSTER_BOXCUT = "CLUSTER_BOXCUT",
}
interface Evictor {
  /**
   * Method to evict tiles from cache that are stale due to a change in the database
   * @param deltaPolys A set of polygons representing the changes in the database
   */
  evict(collectionId: string): Promise<Set<string>>;
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
  const maxZoom = process.env.MAX_ZOOM
    ? parseInt(process.env.MAX_ZOOM)
    : DEFAULT_MAX_ZOOM;
  let strategy: EvictionStrategy;

  if (options.strategy === undefined) {
    throw new Error("No eviction strategy provided.");
  }
  try {
    strategy =
      EvictionStrategy[
        options.strategy as unknown as keyof typeof EvictionStrategy
      ];
  } catch (e) {
    fastify.log.error(
      "Invalid eviction strategy:",
      options.strategy,
      "Valid strategies are:",
      Object.keys(EvictionStrategy)
    );
    throw e;
  }

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

  function logMvts(mvts: Array<string>) {
    if (fastify.log.level !== "info") {
      return;
    }
    const numLoggedMvts = Math.min(mvts.length, MAX_TRACE);

    for (let i = 0; i < numLoggedMvts; i++) {
      fastify.log.info(mvts[i]);
      if (i === MAX_TRACE - 1) {
        fastify.log.info("...");
      }
    }
  }
  /* Pseudo 
      N = tables.patch_features(collection_id)
      E = tables.features(collection_id)
      evict(N, E)
        -> evictStrat1 =: raster
        -> evictStrat2 =: boxcut
        -> evictStrat3 =: cluster search
      */
  switch (strategy) {
    // Fallthrough to be more user-friendly when typing the strategy name
    case EvictionStrategy.RASTER_BO:
    case EvictionStrategy.RASTER_BOTTOM_UP:
      fastify.log.info(
        `Using Eviciton Strategy: Bresenham Bottom Up with Max Zoom ${maxZoom}`
      );
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
          const patchDeltaTimer = fastify.performanceMeter.startTimer(
            `raster-bo-evict-patchDelta-${collectionId}`
          );
          const deltaPolys = await fastify.db
            .getPatchDelta(collectionId)
            .catch((e) => {
              fastify.log.error("Error trying to get patch delta", e);
              patchDeltaTimer.stop(false);
              throw e;
            });
          patchDeltaTimer.stop(true);

          const rasterTimer = fastify.performanceMeter.startTimer(
            `raster-bo-evict-rasterize-${collectionId}`
          );
          fastify.log.debug(`Delta Polys: ${deltaPolys.toString()}`);
          const points = parsePolyPoints(deltaPolys);
          fastify.log.debug(`Delta Poly Points: ${points.toString()}`);

          const mvts = rasterize(points, maxZoom);
          rasterTimer.stop(true);

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
          const findMvtParentsTimer = fastify.performanceMeter.startTimer(
            `raster-bo-evict-parents-${collectionId}`
          );
          const parentMvtStrings = findMvtParents(maxZoom, fmtMvts);
          findMvtParentsTimer.stop(true);

          fastify.log.metric(`Evicting ${mvtStrings.size} tiles`);
          logMvts(Array.from(mvtStrings));
          fastify.log.debug(`Evicting ${parentMvtStrings.size} parent tiles`);
          logMvts(Array.from(parentMvtStrings));

          await evictEntries(parentMvtStrings);
          await evictEntries(mvtStrings);
          return mvtStrings;
        },
      } satisfies Evictor);
      break;
    case EvictionStrategy.BOXCUT_BO:
    case EvictionStrategy.BOXCUT_BOTTOM_UP:
      fastify.log.info(
        `Using Eviciton Strategy: Boxcut Bottom Up with Max Zoom ${maxZoom}`
      );
      fastify.decorate("evictor", {
        /** Compares the entries in the tables features and patch_features of a given
         * collection and finds corresponding MVTs that need to be invalidated, using
         * the following strategy:
         * 1. Get features from patch_features table (N)
         * 2. Get features from features table (E)
         * 3. Build the bounding box of N and E
         * 4. Build the union of N and E =: U
         * 5. Run over all MVTs in passed mvtTable and check if they intersect with U
         * 6. Return all intersecting MVTs in form of z/x/y
         */
        async evict(collectionId: string) {
          const getMvtStringsTimer = fastify.performanceMeter.startTimer(
            `boxcut-bo-evict-${collectionId}`
          );
          const mvtStrings = await fastify.db.getPatchedMVTStringsBoxcut(
            collectionId,
            maxZoom
          );
          getMvtStringsTimer.stop(true);

          const findMvtParentsTimer = fastify.performanceMeter.startTimer(
            `boxcut-bo-evict-parents-${collectionId}`
          );
          const parentMvtStrings = findMvtParents(maxZoom, mvtStrings);
          findMvtParentsTimer.stop(true);

          fastify.log.metric(`Evicting ${mvtStrings.size} tiles`);
          logMvts(Array.from(mvtStrings));
          fastify.log.metric(`Evicting ${parentMvtStrings.size} parent tiles`);
          logMvts(Array.from(parentMvtStrings));

          await evictEntries(parentMvtStrings);
          await evictEntries(mvtStrings);
          return mvtStrings;
        },
      } satisfies Evictor);
      break;
    case EvictionStrategy.BOXCUT_TD:
    case EvictionStrategy.BOXCUT_TOP_DOWN:
      throw new Error("Not implemented");
    case EvictionStrategy.EXACT:
      fastify.log.info(
        `Using Eviction Strategy: EXACT with Max Zoom ${maxZoom}`
      );
      fastify.decorate("evictor", {
        async evict(collectionId: string) {
          const getMvtStringsTimer = fastify.performanceMeter.startTimer(
            `exact-evict-${collectionId}`
          );
          const mvtStrings = await fastify.db.getPatchedMVTStringsExact(
            collectionId,
            maxZoom
          );
          getMvtStringsTimer.stop(true);

          const findMvtParentsTimer = fastify.performanceMeter.startTimer(
            `exact-evict-parents-${collectionId}`
          );
          const parentMvtStrings = findMvtParents(maxZoom, mvtStrings);
          findMvtParentsTimer.stop(true);

          fastify.log.metric(`Evicting ${mvtStrings.size} tiles`);
          logMvts(Array.from(mvtStrings));
          fastify.log.metric(`Evicting ${parentMvtStrings.size} parent tiles`);
          logMvts(Array.from(parentMvtStrings));

          await evictEntries(parentMvtStrings);
          await evictEntries(mvtStrings);
          return mvtStrings;
        },
      } satisfies Evictor);
      break;

    case EvictionStrategy.CLUSTER_BOXCUT:
      fastify.log.info(
        `Using Eviction Strategy: Cluster Boxcut with Max Zoom ${maxZoom}`
      );
      fastify.decorate("evictor", {
        async evict(collectionId: string) {
          const getMvtStringsTimer = fastify.performanceMeter.startTimer(
            `cluster-boxcut-evict-${collectionId}`
          );
          const mvtStrings = await fastify.db.getPatchedMVTStringsClusterBoxcut(
            collectionId,
            maxZoom
          );
          getMvtStringsTimer.stop(true);

          const findMvtParentsTimer = fastify.performanceMeter.startTimer(
            `exact-evict-parents-${collectionId}`
          );
          const parentMvtStrings = findMvtParents(maxZoom, mvtStrings);
          findMvtParentsTimer.stop(true);

          fastify.log.metric(`Evicting ${mvtStrings.size} tiles`);
          logMvts(Array.from(mvtStrings));
          fastify.log.metric(`Evicting ${parentMvtStrings.size} parent tiles`);
          logMvts(Array.from(parentMvtStrings));

          await evictEntries(parentMvtStrings);
          await evictEntries(mvtStrings);
          return mvtStrings;
        },
      } satisfies Evictor);
      break;
    default:
      throw new Error("Invalid eviction strategy");
  }
};

export default fp(cacheEvictionPlugin);
