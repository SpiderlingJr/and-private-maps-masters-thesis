/**
 * This plugin implements logic for finding and evicting tiles from cache that
 * are stale as a result of a change in the database.
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
  evictDiff(deltaPolys: DeltaPolyPaths[]): Promise<void>;
}

const cacheEvictionPlugin: FastifyPluginAsync = async (fastify, options) => {
  async function evict(mvts: Set<string>) {
    try {
      for (const k of mvts) {
        await fastify.cache.del(k);
      }
    } catch (e) {
      fastify.log.error("Error during eviction:", e);
      throw e;
    }
  }
  fastify.decorate("evictor", {
    async evictDiff(deltaPolys: DeltaPolyPaths[], maxZoom = 18) {
      const points = parsePolyPoints(deltaPolys);
      fastify.log.debug("Delta Poly Points:", points);

      for (let i = 0; i < points["points"].length; i++) {
        const p = points["points"][i];
        fastify.log.debug(`[${p[0]}, ${p[1]}]`);
        if (
          i != points["points"].length - 1 &&
          points["ppath"][i][0] < points["ppath"][i + 1][0]
        ) {
          fastify.log.trace("NEW POLY");
        }
      }
      const mvts = rasterize(points, maxZoom);

      // Set of MVTs formatted as string in the form of z/x/y
      const fmtMvts = new Set<string>();
      for (const m of mvts) {
        fmtMvts.add(`${m[0]}/${m[1]}/${m[2]}`);
      }

      const parentMvtStrings = findMvtParents(maxZoom, fmtMvts);

      fastify.log.debug("Evicting Tiles", parentMvtStrings);

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

        fastify.log.trace("Parents");
        let j = 0;
        parentMvtStrings.forEach((m) => {
          j++;
          fastify.log.trace(m);
          if (j >= maxTrace) {
            fastify.log.trace("...");
            return;
          }
        });
      }
      const mvtStrings = new Set<string>();
      for (const m of mvts) {
        mvtStrings.add(`${m[0]}/${m[1]}/${m[2]}`);
      }

      await evict(mvtStrings);
      await evict(parentMvtStrings);
      return;
    },
  } satisfies Evictor);
};
export default fp(cacheEvictionPlugin);
