import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";

import { jobIdSchema } from "../schema/httpRequestSchemas.js";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  // Declare a route
  app.get(
    "/randomRoute",
    {
      schema: {
        querystring: Type.Object({
          foo: Type.Number(),
          bar: Type.String(),
        }),
      },
    },
    function (request, reply): void {
      const replyansw = request.query as { foo: number; bar: string };

      reply.send({ foo: replyansw.foo });
    }
  );

  app.get("/somePolys", async function (request, reply) {
    const aa = await app.cache.set("test", "test");
    const somepolys = await app.db.testme();

    reply.send(somepolys);
  });

  app.get(
    "/job/:jobId",
    {
      schema: { params: jobIdSchema },
    },
    async function (request, reply) {
      const { jobId } = request.params;

      const jobResponse = (await pgConn.getJobById(jobId))[0];

      reply.send(jobResponse);
    }
  );

  app.addHook("onClose", async () => {
    console.log("stopping routes");
  });
}
