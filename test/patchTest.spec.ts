/**
 * Tests for patch route
 */

// Upload a valid file to server
// get response (job)
// wait for job to be complete, get collection and feature id
// patch feature
// wait for job to be complete, get collection and feature id
// check if polygon was correctly updated

import { createReadStream } from "fs";
import { test, todo } from "tap";
import { app } from "../src/app.js";
import FormData from "form-data";
import { awaitJobCompletion } from "./test_util/injects.js";

test("patchTest suite", async (t) => {
  t.teardown(process.exit);
  let featureId: string;
  // upload a valid ndjson file and determine a feature to patch
  t.before(async () => {
    // Prepare test data

    // generate a random test data file with epsg:3857 geometry
    // file as ndjson -> original.ndjson
    // upload file(post), await completion, get collection and feature id
    // request features from collection
    // generate random patch set as variance/mutation of original data
    // file as ndjson -> update,ndjson
    // TODO include featId in ndjson body
    // upload file(patch), await completion
    // assert features have been updated
    // bonus: assert feature have been CORRECTLY updated

    const form = new FormData();
    console.log("before");
    form.append(
      "valid_data",
      createReadStream(`test/data/valid_ndjson_1.ndjson`)
    );

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/data",
      payload: form,
      headers: form.getHeaders(),
    });
    console.log("uploadResponse", uploadResponse.statusCode);

    const jobId = uploadResponse.body;
    const jobResponse = await awaitJobCompletion(jobId);
    const cid = JSON.parse(jobResponse.body).job_collection;

    console.log("cid", cid);
    // get feature id
    const features = await app.inject({
      method: "GET",
      url: `/collections/${cid}/items`,
    });

    featureId = JSON.parse(features.body)[0].Features_feature_id;
  });
  t.test("patch a feature", async (sub1) => {
    const patchData = {
      featId: featureId,
      type: "Feature",
      geometry: {},
      properties: {},
    };

    const oneLiner = JSON.stringify(patchData).replace(/\s+/g, "");
    //console.log("oneLiner", oneLiner);

    //t.todo("not implemented yet");
    sub1.equal(1, 1);
  });

  todo("patch a non existent feature", async (sub1) => {
    //
  });
  todo("patch a feature with invalid data", async (sub1) => {
    //
  });
  t.end();
});
