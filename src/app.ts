import { fastify, RequestParamsDefault } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import closeWithGrace from "close-with-grace";
import { pipeline } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";
import fastifyMultipart from "@fastify/multipart";
import { FastifyRequest } from "fastify";
import { GeodataUpstreamHandler } from "./util/GeodataUpstreamHandler.js";
import * as path from "path";
import { PostGisConnection } from "./util/PostGisConnection.js";
const pump = promisify(pipeline);

import appLinks from "./data/landingPage.js";
import conformance from "./data/conformance.js";
import { REPL_MODE_SLOPPY } from "repl";

const pgConn = new PostGisConnection();
const featureValidator = new GeodataUpstreamHandler(pgConn);

interface RequestParams {
  featId: string;
  colId: string;
  featureId: string;
}

interface TileQueryParams {
  collId: string;
  z: number;
  x: number;
  y: number;
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

// Landing Page
app.get("/", function (request, reply) {
  const response = {
    title: "AND Private Maps API Definition",
    description: "Some descriptive lorem ispum",
    links: appLinks,
  };

  reply.send(response);
});

// Conformance
app.get("/conformance", function (request, reply) {
  reply.send(conformance);
});

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

app.get("/collections", function (request, reply) {
  pgConn
    .listCollections()
    .then((collections) => {
      reply.code(200);
      reply.send(collections);
    })
    .catch((err) => {
      reply.code(500);
      reply.send({ description: "Could not fetch collections." });
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
      .getFeaturesByCollectionId(
        colId,
        Number(limit) ? Number(limit) : undefined
      )
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

// Returns collection info if collection exists, else 404
app.get("/collections/:colId", function (request, reply) {
  const { colId } = request.params as RequestParams;

  pgConn
    .getCollectionById(colId)
    .then((response) => {
      if (response.length > 0) {
        reply.code(200).send(response);
      } else {
        reply.code(404).send();
      }
    })
    .catch((err) => {
      reply.code(404).send(err);
    });
});

app.get("/newzea", async function (req, reply) {
  const mvt = await pgConn.mvtDummyData();

  reply.code(200).send(mvt);
});

app.addHook("onClose", (instance, done) => {
  closeListeners.uninstall();
  done();
});

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
      .getFeatureByCollectionIdAndFeatureId(colId, featId)
      .then((response) => {
        //const a = JSON.parse(response);
        if (response.length > 0) {
          reply.code(200);
          reply.send(response);
        } else {
          reply.code(404).send();
        }
      })
      .catch((err) => {
        reply.code(400);
        reply.send(err);
      });
  }
);

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
  function (request, reply) {
    reply.send({ foo: request.query.foo });
  }
);

app.post("/data", async function (req: FastifyRequest, reply) {
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

app.get("/:collId/:z/:x/:y", function (request, reply) {
  const { collId, z, x, y } = request.params as TileQueryParams;

  pgConn.getMVT(collId, z, x, y);
  reply.send(`Queried ${collId} z:${z} x:${x} y:${y}`);
});
/*
// Insert data into db if not already exists
app.put("/data", async function name(req, reply) {
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
    featureValidator.validateAndPutGeoFeature(tmpStorage, jobId);
  });

  reply.send(jobId);
});
*/
/*
// Insert data into db if already exists
app.patch("/data", async function name(req, reply) {
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
    featureValidator.validateAndPatchGeoFeature(tmpStorage, jobId);
  });
  reply.send(jobId);
});

// Delete existing data
app.delete("/data", async function name(req, reply) {
  //
});

*/

export { app };
