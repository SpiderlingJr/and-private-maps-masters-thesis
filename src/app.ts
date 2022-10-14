import { fastify, RequestParamsDefault } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import closeWithGrace from "close-with-grace";
import { pipeline } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";
import fastifyMultipart from "@fastify/multipart";
import { FastifyRequest } from "fastify";
import { GeodataUpstreamHandler } from "./GeodataUpstreamHandler.js";
import * as path from "path";
import { PostGisConnection } from "./PostGisConnection.js";
const pump = promisify(pipeline);

const pgConn = new PostGisConnection();
const featureValidator = new GeodataUpstreamHandler(pgConn);

interface RequestParams {
  featId: string;
  colId: string;
  featureId: string;
}

// Instantiate Fastify with some config
const app = fastify({
  logger: {
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    level:
      process.env.DEBUG != null
        ? "debug"
        : process.env.NODE_ENV === "test"
        ? "error"
        : "info",
  },
}).withTypeProvider<TypeBoxTypeProvider>();

app.register(fastifyMultipart.default, {
  limits: {
    files: 1, // cannot handle more than 1 file atm
  },
});

app.post("/mp", async function (req: FastifyRequest, reply) {
  const data = await req.file();

  const ftype: string = data.filename.split(".").slice(-1)[0];

  // Assure file is ndjson/ndgeojson
  if (!["ndjson", "ndgeojson"].includes(ftype)) {
    reply
      .status(400)
      .send(
        new Error(`Invalid File Type: ${ftype}. Expected ndjson | ndgeojson .`)
      );
  }

  const jobId = await pgConn.createNewJob();

  // temporarily store received data, for later validation of geojson content
  const tmpStorage = path.join(
    process.cwd(),
    "storage",
    "received",
    jobId + ".ndjson"
  );

  await pump(data.file, createWriteStream(tmpStorage));

  setImmediate(() => {
    featureValidator.validateAndUploadGeoFeature(tmpStorage, jobId);
  });

  reply.send(jobId);
});

// Returns collection info if collection exists, else 404
app.get("/collections/:colId", function (request, reply) {
  const { colId } = request.params as RequestParams;

  pgConn
    .getCollectionById(colId)
    .then((response) => {
      reply.code(200);
      reply.send(response);
    })
    .catch((err) => {
      reply.code(404);
      reply.send(err);
    });
});

app.get(
  "/collections/:colId/items",
  {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.String()),
        datetime: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()),
      }),
    },
  },
  function (request, reply) {
    const { colId } = request.params as RequestParams;

    const limit = request.query.limit;
    const datetime = request.query.datetime;
    const bbox = request.query.bbox;

    pgConn
      .getFeaturesByCollectionId(colId, Number(limit) ? Number(limit) : 0)
      .then((response) => {
        reply.code(200);
        reply.send(response);
      })
      .catch((err) => {
        reply.code(404);
        reply.send(err);
      });
  }
);

app.get(
  "/collections/:colId/items/:featId",
  {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.String()),
        datetime: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()),
      }),
    },
  },
  function (request, reply) {
    const { colId, featId } = request.params as RequestParams;

    pgConn
      .getFeaturesByCollectionIdAndFeatureId(colId, featId)
      .then((response) => {
        reply.code(200);
        reply.send(response);
      })
      .catch((err) => {
        reply.code(404);
        reply.send(err);
      });
  }
);

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
