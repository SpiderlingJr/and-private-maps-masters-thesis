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
    const timer = app.performanceMeter.startTimer(`postJob-${jobId}`);

    await app.validate.validateData(data, colId, jobId).then(async (valid) => {
      if (!valid) {
        app.db.updateJob(jobId, JobState.ERROR, colId, "Invalid GeoJSON.");
        reply.code(400).send({
          error: "Bad Request",
          message: "Invalid GeoJSON.",
        });
        timer.stop(false);
        return;
      }

      await app.db.updateJob(
        jobId,
        JobState.PENDING,
        colId,
        "File validated, waiting for upload."
      );

      await app.db
        .copyToFeatures(`./storage/validated/${jobId}.csv`)
        .then(async () => {
          await app.db.updateJob(
            jobId,
            JobState.FINISHED,
            colId,
            "Upload finished."
          );
          reply.send({
            jobId: jobId,
            collectionId: colId,
          });
        })
        .catch(async (e) => {
          await app.db.updateJob(jobId, JobState.ERROR, colId, e.message);
          reply.code(500).send({
            error: "Internal Server Error",
            message: "Could not upload validated file:\n" + e.message,
          });
          timer.stop(false);
        })
        .finally(async () => {
          // TODO change this to caching strategy
          await app.cache.clear();

          await app.files.deleteFile(`./storage/validated/${jobId}.csv`);
          timer.stop(true);
        });
    });
  });

  /**
   * Patches a single collection
   */
  app.patch(
    "/collections/:collId",
    {
      schema: {
        params: collIdSchema,
      },
    },
    async function (req, reply) {
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
      const collId = req.params.collId;

      reply.send(jobId);

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
        // Stream patch data to temporary table
        // TODO on error -> rollback
        await app.db
          .copyToPatchFeatures(`./storage/validated/${jobId}.csv`)
          .then(async () => {
            app.files.deleteFile(`./storage/validated/${jobId}.csv`);
          });
        // Find all mvts that are affected by the patch

        const totalEvictionTimer = app.performanceMeter.startTimer(
          `patchJob-totalEviction-${jobId}`
        );
        await app.evictor.evict(collId).then(async (droppedTiles) => {
          totalEvictionTimer.stop(true);
          // Apply patch to database
          await app.db.patchCollection(collId);
          await app.db.updateJob(
            jobId,
            JobState.FINISHED,
            collId,
            "Patch finished."
          );

          if (process.env.RELOAD_CACHE === "true") {
            /**
             * Reload dropped stale tiles into cache
             */
            app.log.metric(`Reloading ${droppedTiles.size} tiles.`);
            const reloadTimer = app.performanceMeter.startTimer(
              `patchJob-cacheReload-${jobId}`
            );
            const reloadJobId = await app.db.createJob();

            await app.db
              .fillCache(collId, droppedTiles)
              .then(async (numTiles) => {
                const ms = reloadTimer.stop(true);
                const defaultMaxReload = 1000;
                let reloadMessage;
                if (numTiles == defaultMaxReload) {
                  const avgReloadTime = ms / numTiles;
                  reloadMessage = `Reloaded ${
                    droppedTiles.size
                  }, max reload reached. 
                    Avg. reload time: ${avgReloadTime}ms. Expected  total reload 
                    time: ${avgReloadTime * droppedTiles.size} ms.`;
                  fastify.log.metric(reloadMessage);
                } else {
                  reloadMessage = `Reloaded ${droppedTiles.size} tiles in ${ms}ms.`;
                  fastify.log.metric(reloadMessage);
                }
                await app.db.updateJob(
                  reloadJobId,
                  JobState.FINISHED,
                  collId,
                  `Reloaded ${droppedTiles.size} tiles in ${ms}ms.`
                );
              });
          }
        });
      } catch (e: any) {
        fastify.log.error("Error during patching:" + e.message);
        await app.db.updateJob(jobId, JobState.ERROR, collId, e.message);
      } finally {
        app.db.deletePatchCollection(collId);
      }
    }
  );
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
        .then(async () => {
          await app.db.updateJob(
            jobId,
            JobState.FINISHED,
            collId,
            "Collection deleted"
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
