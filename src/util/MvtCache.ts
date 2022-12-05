import { createClient } from "redis";
import { RedisClientType } from "@redis/client";

export class MvtCache {
  redisCache: RedisClientType;
  redisPromise: Promise<void>;

  constructor() {
    this.redisPromise = this.connectCache();
  }

  async connectCache(): Promise<void> {
    try {
      this.redisCache = createClient({
        url: "redis://@localhost:6378",
      });
      this.redisCache.on("error", (err) => {
        throw new Error("Could not connect to cache: ", err);
      });
      return this.redisCache.connect();
    } catch (err) {
      throw Error("Error in connectCache:" + err);
    }
  }

  async initialized() {
    await this.redisPromise;
  }

  /**
   * Stores a mvt tile in cache, assigend to given key
   * @param key
   * @param mvtTileData
   * @returns
   */
  async cacheTile(key: string, mvtTileData: any) {
    await this.initialized();
    return await this.redisCache.set(key, mvtTileData);
  }

  /**
   * Requests a cached Tile. Returns undefined if not in cache.
   */
  async getTile(key: string) {
    await this.initialized();
    return await this.redisCache.get(key);
  }

  /**
   * Clears the entire cache
   */
  async clear() {
    await this.initialized();
    return await this.redisCache.flushDb();
  }
}
