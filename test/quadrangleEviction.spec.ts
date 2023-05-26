/**
 * Tests with simpleQuadrangle data
 * Using different strategies for eviction  and logging the results
 * using tap
 *  */
import { app } from "../src/app.js";
import { test } from "tap";
import { createReadStream, readFileSync } from "fs";
import prepUpdate from "./test_util/dataGenerator/PrepUpdateSet.js";
import { awaitJobCompletion } from "./test_util/injects.js";

/** This test is intended to test the eviction of two completely disjunct
 *  quadrangle features
 */
test("quadrangleEviction", async (t) => {
  t.teardown(process.exit);

  const originalPath =
    "test/data/static/simpleQuadrangles1/bigQuadrangle.ndjson";
  const updatePath = "test/data/static/simpleQuadrangles1/nazca.ndjson";
  // load update set as json
  const updateCollection = await prepUpdate.loadNdjsonAsFeatureCollection(
    updatePath
  );
  /* 
  1. Upload E, receive assigned collectionId and featureIds
   */
  const postResponse = await prepUpdate.postFeaturesToService(originalPath);
  const jobId = postResponse.body;
  const jobResponse = await awaitJobCompletion(jobId);
  const collectionId = JSON.parse(jobResponse.body).job_collection;
  const featureIds = await prepUpdate.getFeatureIdsFromService(collectionId);

  /*
  TODO IMPLEMENT
  1.5 Simulate frontend activity / caching of MVTs be calling for xyz.vector.pbf
  */

  /*
  2. Upload N as PATCH, receive assigned featureIds
  */
  const updateSetWithIds = prepUpdate.assignPropertyToFeatureCollection(
    updateCollection,
    "featId",
    featureIds
  );
  // store update set as ndjson
  const updateSetPath =
    "test/data/static/simpleQuadrangles1/nazcaWithIds.ndjson";
  prepUpdate.writeAsNdjson(updateSetWithIds, updateSetPath);

  const patchResponse = await prepUpdate.patchFeatures(
    collectionId,
    updateSetPath
  );
  const patchJobResponse = await awaitJobCompletion(patchResponse.body);

  app.log.info(`jobId: ${jobId}`);
  app.log.info(`featureIds: ${featureIds}`);
  app.log.info(`collectionId: ${collectionId}`);
  app.log.info(`patchResponse ${patchResponse.statusCode}`);
  app.log.info(
    `patchJobResponse ${patchJobResponse.statusCode}, ${patchJobResponse.body}`
  );
});

/**
 * TODO PERFECT EVICTION (regardless of runtime)
 * 1. Upload E
 * 2. Receive MVT(E, z)
 * 3. Update E -> N (PATCH)
 * 4. LOG MVT(E.union(N), z) <- Correct MVT amount
 */
