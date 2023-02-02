import { Type } from "@sinclair/typebox";
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";
export default async function (
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
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

  app.addHook("onClose", async () => {
    console.log("stopping routes");
  });
}
