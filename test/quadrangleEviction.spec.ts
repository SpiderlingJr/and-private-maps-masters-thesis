/**
 * Tests with simpleQuadrangle data
 * Using different strategies for eviction  and logging the results
 * using tap
 *  */
import { test } from "tap";
import { createReadStream } from "fs";
import { prepUpdate } from "./test_util/dataGenerator/PrepUpdateSet.js";
import { awaitJobCompletion } from "./test_util/injects.js";

/** This test is intended to test the eviction of two completely disjunct
 *  quadrangle features
 * TODO PERFECT EVICTION (regardless of runtime)
 * 1. Upload E
 * 2. Receive MVT(E, z)
 * 3. Update E -> N (PATCH)
 * 4. LOG MVT(E.union(N), z) <- Correct MVT amount
 */
test("quadrangleEviction", async (t) => {
  const originalPath =
    "test/data/static/simpleQuadrangles1/bigQuadrangle.ndjson";
  //const updatePath = "test/data/static/simpleQuadrangles1/nazca.ndjson";
  // load update set as json
  //const updateSet = JSON.parse(createReadStream(updatePath).toString());

  const postResponse = await prepUpdate.postFeaturesToService(originalPath);
  await new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
    if (!postResponse) {
      // 1 sec should be enough for the job to finish
      throw new Error("JobId not found, aborting");
    }
  });
  const jobId = postResponse.body;
  const jobResponse = await awaitJobCompletion(jobId);
  const collectionId = JSON.parse(jobResponse.body).job_collection;
  const featureIds = await prepUpdate.getFeatureIdsFromService(collectionId);

  console.log("jobId", jobId);
  console.log("featureIds", featureIds);
  console.log("collectionId", collectionId);

  // TODO IMPLEMENT  insert featureIds into N

  // TODO call PATCN with collectionId and N

  t.test("upload E", async (t) => {
    //
  });
});
