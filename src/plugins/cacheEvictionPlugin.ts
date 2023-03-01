/**
 * This plugin is responsible for evicting tiles from cache after they have been updated.
 * It implements logic to find the contents of the cache that are stale due to a change in the database and evicts them.
 */
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { DeltaPolyPaths } from "./dbPlugin";
import {
  findMvtParents,
  parsePolyPoints,
  rasterize,
} from "./eviction/evictionUtil";

declare module "fastify" {
  interface FastifyInstance {
    evictor: Evictor;
  }
}

interface Evictor {
  /**
   * Method to evict tiles from cache that are stale due to a change in the database
   * @param deltaPolys A set of polygons representing the changes in the database
   */
  evictDiffFromCache(deltaPolys: DeltaPolyPaths[]): Promise<void>;
}

const cacheEvictionPlugin: FastifyPluginAsync = async (fastify, options) => {
  async function runEviction(mvts: Set<string>, parents: Set<string>) {
    try {
      for (const k of mvts) {
        await fastify.cache.del(k);
      }
      for (const k of parents) {
        await fastify.cache.del(k);
      }
    } catch (e) {
      console.log("error evicting from cache");
      console.error(e);
    }
  }
  fastify.decorate("evictor", {
    async evictDiffFromCache(deltaPolys: DeltaPolyPaths[], maxZoom = 18) {
      //console.log("evicting from cache");
      //console.log("deltaPolys", deltaPolys);

      const points = parsePolyPoints(deltaPolys);
      fastify.log.debug("Delta Poly Points");
      console.log(points);

      for (let i = 0; i < points["points"].length; i++) {
        const p = points["points"][i];
        fastify.log.debug(`[${p[0]}, ${p[1]}]`);
        if (
          i != points["points"].length - 1 &&
          points["ppath"][i][0] < points["ppath"][i + 1][0]
        ) {
          fastify.log.debug("NEW POLY");
        }
      }
      const mvts = rasterize(points, maxZoom);

      const fmtMvts = new Set<string>();
      for (const m of mvts) {
        fmtMvts.add(`${m[0]}/${m[1]}/${m[2]}`);
      }

      const parents = findMvtParents(maxZoom, fmtMvts);

      fastify.log.debug("mvts", mvts);
      /*mvts.forEach((m) => {
        fastify.log.debug(`${m[0]}/${m[1]}/${m[2]}`);
      });
      */
      fastify.log.debug("Evicting Tiles", parents);
      let count = 0;
      parents.forEach((m) => {
        const mSplit = m.split("/");
        count++;
        fastify.log.debug(`${mSplit[0]}/${mSplit[1]}/${mSplit[2]}`);
        if (count > 100) {
          fastify.log.debug(`... ${parents.size - count} more`);
          return;
        }
      });

      const mvtStrings = new Set<string>();
      for (const m of mvts) {
        mvtStrings.add(`${m[0]}/${m[1]}/${m[2]}`);
      }

      await runEviction(mvtStrings, parents);
      return;
    },
  } satisfies Evictor);
};
export default fp(cacheEvictionPlugin);
