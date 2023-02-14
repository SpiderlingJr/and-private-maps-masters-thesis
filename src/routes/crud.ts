/** Routes for CRUD operations that are not specified in OGC */

import { FastifyInstance } from "fastify";
import { FastifyPluginOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { collIdSchema } from "src/schema/httpRequestSchemas";
import { JobState } from "src/entities/jobs";
import fastifyMultipart from "@fastify/multipart";
export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  options;

  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

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
    await app.validate.validateData(data, colId, jobId).then(async (valid) => {
      if (!valid) {
        app.db.updateJob(jobId, JobState.ERROR, colId, "Invalid GeoJSON.");
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
        .copyStreamCollection(`./storage/validated/${jobId}.csv`)
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

          await app.files.deleteFile(`./storage/validated/${jobId}.csv`);
        });
    });
  });

  // Insert data into db if already exists
  // TODO check if application type is ndjson
  app.patch("/data", async function patchData(req, reply) {
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
    const collId = await app.db.createCollection();

    reply.send(jobId);
    /*
    await app.jobManager.run(
      app.validate.validateData(data, collId, jobId, "UPDATE"),
    )*/

    try {
      const isValid = await app.validate.validateData(
        data,
        collId,
        jobId,
        "UPDATE"
      );
      if (!isValid) {
        app.db.updateJob(jobId, JobState.ERROR, collId, "Invalid GeoJSON.");
        reply.code(400).send({
          error: "Bad Request",
          message: "Invalid GeoJSON.",
        });
        return;
      }
      await app.db.updateJob(
        jobId,
        JobState.PENDING,
        collId,
        "File validated, patching..."
      );
      // Patch logic here
      const diffPolys = await app.db
        .patchAndGetDiff(`./storage/validated/${jobId}.csv`)
        .catch((e) => {
          console.log("eeee", e);
        });

      if (diffPolys) {
        await app.evictor.evictDiffFromCache(diffPolys);
      }

      // get diff polygons, rasterize their MVT
      console.log("diffPolys", diffPolys);
      // remove diff mvts from cache, and reload them
    } catch (e: any) {
      console.log("error", e);
      await app.db.updateJob(jobId, JobState.ERROR, collId, e.message);
    }
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
