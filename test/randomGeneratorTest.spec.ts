// Test that checks if the random generator works as expected

import generateRandomGeoFeatures from "./test_util/dataGenerator/spitRandomGeoms.js";

import { test } from "tap";

test("random generator", async (t) => {
  t.teardown(process.exit);
  await generateRandomGeoFeatures(3, "test/data", "notRandom")
    .then((res) => {
      console.log("Generated collection: ", res.collectionId);
      t.pass("random generator works");
    })
    .catch((err) => {
      console.log("Error in random generator test");
      t.fail(err);
    });
});
