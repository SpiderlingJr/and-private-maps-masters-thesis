/** Routes for CRUD operations that are not specified in OGC */

import { FastifyInstance } from "fastify";
import { FastifyPluginOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import * as path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";
import { PostGisConnection } from "src/util/PostGisConnection";
import { GeodataUpstreamHandler } from "src/util/GeodataUpstreamHandler";

import { collIdSchema } from "src/schema/httpRequestSchemas";
import { JobState } from "src/entities/jobs";
import fastifyMultipart from "@fastify/multipart";
export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const pump = promisify(pipeline);
  const pgConn = new PostGisConnection();
  const featureValidator = new GeodataUpstreamHandler(pgConn);

  app.register(fastifyMultipart, {
    limits: {
      files: 1, // cannot handle more than 1 file atm
    },
  });

  app.post("/data", async function (req, reply) {
    const data = await req.file();

    const ftype: string = data.filename.split(".").slice(-1)[0];

    // Assure file is ndjson/ndgeojson
    if (!["ndjson", "ndgeojson"].includes(ftype)) {
      reply
        .status(400)
        .send(
          new Error(
            `Invalid File Type: ${ftype}. Expected ndjson | ndgeojson .`
          )
        );
    }

    const jobId = await app.db.createNewJob();

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

    await app.cache.clear();
    reply.code(200).send(jobId);
  });

  // Insert data into db if already exists
  app.patch("/data", async function name(req, reply) {
    const data = await req.file();

    const ftype: string = data.filename.split(".").slice(-1)[0];

    // Assure file is ndjson/ndgeojson
    if (!["ndjson", "ndgeojson"].includes(ftype)) {
      reply
        .status(400)
        .send(
          new Error(
            `Invalid File Type: ${ftype}. Expected ndjson | ndgeojson .`
          )
        );
    }

    const jobId = await app.db.createNewJob();

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

  /*
// Insert data into db if not already exists
// Todo implement put
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

  // Delete existing data
  app.delete(
    "/collections/:collId",
    {
      schema: {
        params: collIdSchema,
      },
    },
    async function name(req, reply) {
      const { collId } = req.params;

      const jobId = await pgConn.createNewJob();
      const delResponse = await pgConn
        .deleteCollection(collId, jobId)
        .then(async (response) => {
          const jobResponse = await pgConn.updateJob(
            jobId,
            JobState.FINISHED,
            collId
          );
        })
        .catch(async (err) => {
          const jobResponse = await pgConn.updateJob(
            jobId,
            JobState.ERROR,
            collId,
            err
          );
        });

      reply.send(jobId);
    }
  );
  app.addHook("onClose", async () => {
    console.log("stopping updateroutes");
  });
}
