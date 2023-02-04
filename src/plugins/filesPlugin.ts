/** Plugin handling temporarily stored files */

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { unlink } from "fs";

declare module "fastify" {
  interface FastifyInstance {
    files: Files;
  }
}
interface Files {
  deleteFile(receivedPath: string): unknown;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const validatorPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("files", {
    deleteFile: (receivedPath: string) => {
      // Deletes the file from the received folder
      unlink(receivedPath, (err) => {
        if (err) {
          console.error(err);
          return;
        }
      });
    },
  } satisfies Files);

  fastify.addHook("onClose", async () => {
    console.log("stopping filesPlugin");
  });
};

export default fp(validatorPlugin);
