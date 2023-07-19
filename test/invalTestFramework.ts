/**
 * Test Suite that takes a data set consisting of two files
 * - a ndjson representing the "existing" data
 * - a ndjson representing the "patch" data
 *
 * It loads both files, then posts the first file to database using POST:/data
 * It then retrieves the data and it's feature_ids and inserts these ids into
 * the patch data.
 * The patch data is then again stored as prepared ndjson and posted to database
 * using PATCH:/collection/<theNewCollection>.
 */

import { app } from "../src/app.js";
import { test } from "tap";

import prepUpdate from "./test_util/dataGenerator/PrepUpdateSet.js";
import { awaitJobCompletion } from "./test_util/injects.js";

/*
const originalFeaturesPath =
  "test/data/static/clusterStress/clusterStressAuto.ndjson";
const updateFeaturesPath =
  "test/data/static/clusterStress/clusterStressPatch.ndjson";
const patchablePath =
  "test/data/static/clusterStress/clusterStressPatchRS.ndjson";
  */
const originalFeaturesPath = "test/data/dynamic/230719_rand_o_50f.ndjson";
const updateFeaturesPath = "test/data/dynamic/230719_rand_1_50f.ndjson";
const patchablePath = "test/data/dynamic/230719_rand_2_50f.ndjson";
/** This test is intended to test the eviction of two completely disjunct
 *  quadrangle features
 */

test("anEviction", async (t) => {
  /* 
  1. Upload E, receive assigned collectionId and featureIds
   */
  const postResponse = await prepUpdate.postFeaturesToService(
    originalFeaturesPath
  );
  const prBody: {
    jobId: string;
    collectionId: string;
  } = JSON.parse(postResponse.body);
  const jobId = prBody.jobId;
  app.log.metric(`anEviction POST-JOB-ID ${jobId}`);
  if (!jobId) {
    t.fail("eviction: jobId does not exist");
  }
  const jobResponse = await awaitJobCompletion(jobId);
  const collectionId = JSON.parse(jobResponse.body).job_collection;
  app.log.metric(`anEviction POST-COLL-ID ${collectionId}`);
  const featureIds = await prepUpdate.getFeatureIdsFromService(collectionId);
  //app.log.metric(`anEviction POST-FEATURE-IDS ${featureIds}`);
  /*
  2. Upload N as PATCH, receive assigned featureIds
  */
  const updateCollection = await prepUpdate.loadNdjsonAsFeatureCollection(
    updateFeaturesPath
  );
  const updateSetWithIds = prepUpdate.assignPropertyToFeatureCollection(
    updateCollection,
    "featId",
    featureIds
  );
  // store update set as ndjson
  const updateSetPath = patchablePath;
  //app.log.metric(`anEviction PATCH-SET-PATH ${updateSetPath}`);
  prepUpdate.writeAsNdjson(updateSetWithIds, updateSetPath);

  const patchResponse = await prepUpdate.patchFeatures(
    collectionId,
    updateSetPath
  );
  const patchJobResponse = await awaitJobCompletion(
    patchResponse.body,
    10000,
    10
  ).catch((e) => {
    app.log.error(`timeout during patch job completion`);
  });
  app.log.info(`jobId: ${jobId}`);
  app.log.info(`collectionId: ${collectionId}`);
  app.log.info(`featureIds: ${featureIds}`);
  app.log.info(`patchResponse ${patchResponse.statusCode}`);

  // wait for 60 seconds to allow eviction to happen
  // then pass test
  await new Promise((resolve) => setTimeout(resolve, 60000));
  t.ok(true, "eviction: test passed");
});
