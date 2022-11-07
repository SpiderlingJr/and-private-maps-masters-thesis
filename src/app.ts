import { fastify } from "fastify";
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
import appLinks from "./data/landingPage.js";
import conformance from "./data/conformance.js";

const pump = promisify(pipeline);

const mvtCache = new Map();
const pgConn = new PostGisConnection();
const featureValidator = new GeodataUpstreamHandler(pgConn);

//const logStream = createWriteStream("./cachelog.txt");

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

app.register(fastifyMultipart, {
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
  "/collections/:collId/items",
  {
    schema: {
      params: Type.Object({
        collId: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.String()),
        datetime: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()),
      }),
    },
  },
  function (request, reply) {
    const { collId } = request.params;

    const limit = request.query.limit;
    const datetime = request.query.datetime;
    const bbox = request.query.bbox;

    pgConn
      .getFeaturesByCollectionId(
        collId,
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
app.get(
  "/collections/:collId",
  {
    schema: {
      params: Type.Object({
        collId: Type.String(),
      }),
    },
  },
  function (request, reply) {
    const { collId } = request.params;

    pgConn
      .getCollectionById(collId)
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
  }
);

app.addHook("onClose", (instance, done) => {
  closeListeners.uninstall();
  done();
});

app.get(
  "/collections/:collId/items/:featId",
  {
    schema: {
      params: Type.Object({
        collId: Type.String(),
        featId: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.String()),
        datetime: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()),
      }),
    },
  },
  function (request, reply) {
    const { collId, featId } = request.params;

    pgConn
      .getFeatureByCollectionIdAndFeatureId(collId, featId)
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

app.get(
  "/collections/:collId/:z/:x/:y",
  {
    schema: {
      params: Type.Object({
        collId: Type.String(),
        x: Type.Integer(),
        y: Type.Integer(),
        z: Type.Integer(),
      }),
    },
  },
  function (request, reply) {
    const { collId, z, x, y } = request.params;

    const mvt = pgConn.getMVT(collId, z, x, y);
    reply.send(mvt);
  }
);

app.get(
  "/collections/:collId/:z/:x/:y.vector.pbf",
  {
    schema: {
      params: Type.Object({
        collId: Type.String(),
        x: Type.Integer(),
        y: Type.Integer(),
        z: Type.Integer(),
      }),
    },
  },
  async function (request, reply) {
    const { collId, z, x, y } = request.params;

    // TODO get minzoom / maxzoom of requested collection
    const { minZoom, maxZoom } = await pgConn.getCollectionZoomLevel(collId);

    if (minZoom <= z && z <= maxZoom) {
      // Is MVT already in cache?
      let mvt = mvtCache.get(`${z}/${x}/${y}`);
      if (mvt) {
        console.log(`we have mvt ${z}/${x}/${y} at home`);
        reply.send(mvt[0].st_asmvt);
      } else {
        // Not already cached, request and cache.

        console.log(`thats new! ${z}/${x}/${y} `);
        mvt = await pgConn.getMVT(collId, z, x, y);
        mvtCache.set(`${z}/${x}/${y}`, mvt);
        reply.send(mvt[0].st_asmvt);
      }
    } else {
      reply.send(200);
    }
  }
);
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
  throw Error("Not yet implemented");
});

app.get("/newzea", async function (req, reply) {
  const mvt = await pgConn.mvtDummyData();

  reply.code(200).send(mvt);
});

export { app };
