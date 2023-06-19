import { FastifyRedis } from "@fastify/redis";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
declare module "fastify" {
  interface FastifyInstance {
    cache: Cache; // fastify.decorate('cache', { ... }); makes this available
  }
}
const storeSymbol = Symbol("store");

/**
 * Implement this interface to provide a cache strategy
 */
interface Cache<T = Map<string, string> | FastifyRedis> {
  get(key: string): Promise<string | Buffer | undefined | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  [storeSymbol]: T;
  stats(): {
    length: number;
  };
}

export enum CacheStrategy {
  REDIS = "REDIS",
  JSMAP = "JSMAP",
}
/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const cachePlugin: FastifyPluginAsync<{
  strategy?: CacheStrategy;
}> = async (fastify, options) => {
  let strategy: CacheStrategy;

  if (options.strategy === undefined) {
    throw new Error("No cache strategy provided.");
  }
  try {
    strategy =
      CacheStrategy[options.strategy as unknown as keyof typeof CacheStrategy];
    console.debug("CacheStrategy", strategy);
  } catch (e) {
    fastify.log.error(
      "Invalid cache strategy:",
      options.strategy,
      "Valid strategies are:",
      Object.keys(CacheStrategy)
    );
    throw e;
  }
  switch (strategy) {
    case CacheStrategy.REDIS:
      fastify.log.info("Using redis cache");
      // Init redis client
      fastify.register(import("@fastify/redis"), {
        host: "localhost",
        port: 6378,
      }); // This makes fastify.redis available I asuume
      fastify.decorate("cache", {
        [storeSymbol]: fastify.redis, // storeSymbol is a symbol that is used to store the redis client in the cache object
        async get(key: string) {
          //return fastify.redis.get(key);

          return fastify.redis.getBuffer(key);
        },
        async set(key: string, value: string, ttl?: number) {
          //fastify.redis.set(key, value);
          fastify.redis.set(key, value);
        },
        async del(key: string) {
          fastify.redis.del(key);
        },
        async clear() {
          fastify.redis.flushdb();
        },
        stats() {
          return {
            length: -99,
          };
        },
      } satisfies Cache<FastifyRedis>); // makes sure that the interface is implemented
      break;
    case CacheStrategy.JSMAP:
      fastify.log.info("Using js map cache");
      fastify.decorate("cache", {
        [storeSymbol]: new Map<string, string>(),
        async get(key: string) {
          return this[storeSymbol].get(key);
        },
        async set(key: string, value: string, ttl?: number) {
          this[storeSymbol].set(key, value);
        },
        async del(key: string) {
          this[storeSymbol].delete(key);
        },
        async clear() {
          this[storeSymbol].clear();
        },
        stats() {
          return {
            length: this[storeSymbol].size,
            entries: Array.from(this[storeSymbol].keys()),
          };
        },
      } satisfies Cache<Map<string, string>>);
      break;
    default:
      throw new Error("Invalid cache strategy");
  }
};
export default fp(cachePlugin);
