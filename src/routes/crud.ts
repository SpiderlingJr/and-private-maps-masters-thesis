/** Routes for CRUD operations that are not specified in OGC */

import { FastifyInstance } from "fastify";
import { FastifyPluginOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import * as path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";

import { collIdSchema } from "src/schema/httpRequestSchemas";
import { JobState } from "src/entities/jobs";
import fastifyMultipart from "@fastify/multipart";
export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  options;

  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const pump = promisify(pipeline);
  //const pgConn = new PostGisConnection();
  //const featureValidator = new GeodataUpstreamHandler(pgConn);

  app.register(fastifyMultipart, {
    limits: {
      files: 1, // cannot handle more than 1 file atm
    },
  });

  app.post("/data", async function (req, reply) {
    const data = await req.file();

    if (!data) {
      reply.code(400).send({
        error: "No file received.",
      });
      return;
    }

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

    const jobId = await app.db.createJob();
    const colId = await app.db.createCollection();

    // temporarily store received data, for later validation of geojson content
    const receivedPath = path.join(
      process.cwd(),
      "storage",
      "received",
      jobId + ".ndjson"
    );
    const validatedPath = path.join(
      process.cwd(),
      "storage",
      "validated",
      jobId + ".csv"
    );

    await pump(data.file, createWriteStream(receivedPath)).then(async () => {
      const valid = app.validate.validateGeoJson(
        receivedPath,
        validatedPath,
        colId
      );
      if (!valid) {
        await app.db.updateJob(
          jobId,
          JobState.ERROR,
          colId,
          "Invalid GeoJSON."
        );
        reply.code(400).send({
          error: "Bad Request",
          message: "Invalid GeoJSON.",
        });
        return;
      }
      await app.db.updateJob(
        jobId,
        JobState.PENDING,
        colId,
        "File validated, waiting for upload."
      );
      await app.db
        .copyStreamCollection(validatedPath)
        .then(async () => {
          await app.db.updateJob(
            jobId,
            JobState.FINISHED,
            colId,
            "Upload finished."
          );
          reply.send(jobId);
        })
        .catch(async (e) => {
          await app.db.updateJob(jobId, JobState.ERROR, colId, e.message);
          reply.code(500).send({
            error: "Internal Server Error",
            message: "Could not upload validated file:\n" + e.message,
          });
        })
        .finally(async () => {
          // TODO change this to caching strategy
          await app.cache.clear();

          // TODO delete received file
          await app.files.deleteFile(receivedPath);
        });
    });
  });

  setImmediate(() => {
    // TODO
  });

  // Insert data into db if already exists
  // TODO check if application type is ndjson
  app.patch("/data", async function name(req, reply) {
    const data = await req.file();

    if (!data) {
      reply.status(400).send(new Error("No file received."));
      return;
    }
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
    const jobId = await app.db.createJob();
    const collId = await app.db.createCollection();
    // temporarily store received data, for later validation of geojson content
    const tmpStorage = path.join(
      process.cwd(),
      "storage",
      "received",
      jobId + ".ndjson"
    );

    await pump(data.file, createWriteStream(tmpStorage));

    setImmediate(() => {
      const outpath = `storage/validated/${jobId}.csv`;

      // TODO
      const validCsvPath = app.validate.validateGeoJson(
        tmpStorage,
        outpath,
        jobId
      );
      if (!validCsvPath) {
        reply.code(400).send({
          error: "Bad Request",
          message: "Invalid GeoJSON.",
        });
        return;
      } else {
        app.db.copyStreamCollection(collId, outpath);
        //featureValidator.validateAndPatchGeoFeature(tmpStorage, jobId);
      }
      reply.send({ jobId });
    });
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

      const jobId = await app.db.createJob();
      await app.db
        .deleteCollection(collId)
        .then(async (response) => {
          await app.db.updateJob(
            jobId,
            JobState.FINISHED,
            collId,
            response.raw
          );
        })
        .catch(async (err) => {
          await app.db.updateJob(jobId, JobState.ERROR, collId, err);
        });

      reply.send(jobId);
    }
  );
  app.addHook("onClose", async () => {
    console.log("stopping updateroutes");
  });
}
