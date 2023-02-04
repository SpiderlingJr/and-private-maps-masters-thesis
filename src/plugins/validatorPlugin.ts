/** Plugin handling validation of posted ndgeojson data */

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { loadAndValidateGeoFeature } from "./validation/validateGeoFeature";

declare module "fastify" {
  interface FastifyInstance {
    validate: GeoValidator;
  }
}
interface GeoValidator {
  validateGeoJson(
    fpath: string,
    outpath: string,
    colId: string
  ): Promise<boolean>;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const validatorPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("validate", {
    async validateGeoJson(fpath: string, outpath: string, colId: string) {
      console.log("validateGeoJson");
      const valid = await loadAndValidateGeoFeature(fpath, outpath, colId);
      return valid;
    },
  } satisfies GeoValidator);

  fastify.addHook("onClose", async () => {
    console.log("stopping validatorPlugin");
  });
};

export default fp(validatorPlugin);
