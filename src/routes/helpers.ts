import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";

import { jobIdSchema } from "../schema/httpRequestSchemas.js";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  options;

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

  app.get(
    "/job/:jobId",
    {
      schema: { params: jobIdSchema },
    },
    async function (request, reply) {
      const { jobId } = request.params;

      const jobResponse = await app.db.getJobById(jobId);

      if (!jobResponse) {
        reply.code(404);
        reply.send({ error: "Job not found" });
        return;
      }
      reply.send(jobResponse);
    }
  );

  app.get("/newjob", async function (req, reply) {
    const newJob = await app.db.createJob();

    reply.code(200).send(newJob);
  });

  app.get("/doink", async function (req, reply) {
    await app.cache.set("doink", "poink");
    reply.send(200);
  });

  app.addHook("onClose", async () => {
    console.log("stopping helper routes");
  });
}
