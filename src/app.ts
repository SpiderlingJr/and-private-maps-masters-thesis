import { fastify } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import closeWithGrace from "close-with-grace";

// Instantiate Fastify with some config
const app = fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();

// Declare a route
app.get(
  "/",
  {
    schema: {
      querystring: Type.Object({
        foo: Type.Number(),
        bar: Type.String(),
      }),
    },
  },
  function (request, reply) {
    reply.send({ foo: request.query.foo });
  }
);

const handler: closeWithGrace.CloseWithGraceAsyncCallback = async ({ err }) => {
  if (err) {
    app.log.error(err);
  }
  await app.close();
};

// delay is the number of milliseconds for the graceful close to finish
const closeListeners = closeWithGrace(
  {
    delay: parseInt(process.env.FASTIFY_CLOSE_GRACE_DELAY || "") || 500,
  },
  handler
);

app.addHook("onClose", (instance, done) => {
  closeListeners.uninstall();
  done();
});

export { app };
