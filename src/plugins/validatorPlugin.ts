/** Plugin handling validation of posted ndgeojson data */

import { MultipartFile } from "@fastify/multipart";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import path from "path";
import { UpdateStrategy } from "src/util/transforms/GeoJsonToCsvTransform";
import {
  loadAndValidateGeoFeature,
  validatePatchData,
  validatePostData,
} from "./validation/validateGeoFeature";

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

  validateData(
    data: MultipartFile,
    colId: string,
    jobId: string,
    updateStrategy?: UpdateStrategy
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
    /**
     * Runs the passed file through the validation process.
     *
     * The file is validated against the GeoJSON schema, and if valid,
     * stored in the validated folder. If invalid, returns an error.
     *
     * @param fpath
     * @param outpath
     * @param colId
     */
    async validateData(
      data: MultipartFile,
      colId: string,
      jobId: string,
      updateStrategy: UpdateStrategy = "POST"
    ) {
      const outpath = path.join(
        process.cwd(),
        "storage",
        "validated",
        jobId + ".csv"
      );
      // Try and validate the file

      if (updateStrategy === "POST") {
        return await validatePostData(data, colId, outpath);
      } else if (updateStrategy === "UPDATE") {
        return await validatePatchData(data, colId, outpath);
      } else {
        throw new Error("Invalid update strategy");
      }
    },
  } satisfies GeoValidator);

  fastify.addHook("onClose", async () => {
    console.log("stopping validatorPlugin");
  });
};

export default fp(validatorPlugin);
