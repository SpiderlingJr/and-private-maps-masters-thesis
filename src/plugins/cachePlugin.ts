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
  get(key: string): Promise<string | undefined | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  [storeSymbol]: T;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const cachePlugin: FastifyPluginAsync<{
  strategy?: "redis" | "memory";
}> = async (fastify, options) => {
  if (options.strategy === "redis") {
    // Init redis client
    fastify.register(import("@fastify/redis"), {
      host: "localhost",
      port: 6378,
    }); // This makes fastify.redis available I asuume
    fastify.decorate("cache", {
      [storeSymbol]: fastify.redis, // storeSymbol is a symbol that is used to store the redis client in the cache object
      async get(key: string) {
        return fastify.redis.get(key);
      },
      async set(key: string, value: string, ttl?: number) {
        fastify.redis.set(key, value);
      },
      async del(key: string) {
        fastify.redis.del(key);
      },
      async clear() {
        fastify.redis.flushdb();
      },
    } satisfies Cache<FastifyRedis>); // makes sure that the interface is implemented
  } else if (options.strategy === "memory") {
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
    } satisfies Cache<Map<string, string>>);
  }
};
export default fp(cachePlugin);
