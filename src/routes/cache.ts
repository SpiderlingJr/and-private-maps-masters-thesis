/** Methods for interacting with the cache. */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { xyzSchema } from "src/schema/httpRequestSchemas";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  options;

  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // For testing the cache
  app.get(
    "/cache/:z/:x/:y",
    {
      schema: {
        params: xyzSchema,
      },
    },
    async function (request, reply) {
      const { z, x, y } = request.params;

      //const mvt = await mvtCache.getTile(`${z}/${x}/${y}`);
      const mvt = await app.cache.get(`${z}/${x}/${y}`);
      if (mvt) {
        console.trace(`Cache hit for ${z}/${x}/${y}`);
        reply.code(200).send(mvt);
      } else {
        reply.code(404);
      }
    }
  );
}
