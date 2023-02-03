import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { collIdSchema, styleSchema } from "src/schema/httpRequestSchemas";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * Allows posting a Style JSON-Object
   */
  app.post(
    "/collections/:collId/style",
    {
      schema: {
        params: collIdSchema,
        body: styleSchema,
      },
    },
    async function (request, reply) {
      const { collId } = request.params;
      const { minZoom, maxZoom } = request.body.Style;

      if (minZoom > maxZoom) {
        reply
          .code(400)
          .send({ error: "minZoom cannot be greater than maxZoom" });
        return;
      }
      try {
        await app.db.setStyle(collId, request.body.Style);
        await app.cache.clear();
        //mvtCache.clear();
        reply.code(200).send();
      } catch (e) {
        reply.code(404).send(e);
      }
    }
  );
}
