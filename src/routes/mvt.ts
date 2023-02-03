// Routes that serve MVT tiles or are related to MVT tiles
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";

import { collIdZXYSchema } from "../schema/httpRequestSchemas.js";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Registrate type provider as stated in https://www.fastify.io/docs/latest/Reference/Type-Providers/
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    "/collections/:collId/:z/:x/:y",
    {
      schema: {
        params: collIdZXYSchema,
      },
    },
    async function (request, reply) {
      const { collId, z, x, y } = request.params;

      const mvt = await app.db.getMVT(collId, z, x, y);
      reply.code(200).send(mvt);
    }
  );

  /**
   * Requests the geometry and property data of a given collection, and returns a VMT protobuf object
   * containing the feature data of requested zoom levels and x/y coordinates.
   */
  app.get(
    "/collections/:collId/:z/:x/:y.vector.pbf",
    {
      schema: {
        params: collIdZXYSchema,
      },
    },
    async function (request, reply) {
      const { collId, z, x, y } = request.params;
      const zxy_key = `${z}/${x}/${y}`;
      const { minZoom, maxZoom } = await app.db.getCollectionZoomLevel(collId);

      // return nothing if z is out of bounds for zoom levels of requested collection
      if (!(minZoom <= z && z <= maxZoom)) {
        console.log("Out of bounds", minZoom, maxZoom);
        reply.code(200).send();
        return;
      }
      // Try fetching requested tile from cache
      const cachedMvt = await app.cache.get(zxy_key);

      if (cachedMvt === "") {
        reply.code(204).send();
      }
      if (cachedMvt) {
        //const mvt = Buffer.from(cachedMvt, "base64");
        //reply.send(mvt);
        reply.send(cachedMvt);
      } else {
        // tile not in cache, request from db and cache.
        let mvt = await app.db.getMVT(collId, z, x, y);
        mvt = mvt[0].st_asmvt;
        // Store new tile in cache
        await app.cache.set(zxy_key, mvt);

        reply.send(mvt);
      }
    }
  );
}
