// Test that checks if the random generator works as expected
import { app } from "../src/app.js";
import generateRandomGeoFeatures from "./test_util/dataGenerator/spitRandomGeoms.js";

import { test } from "tap";

test("random generator", async (t) => {
  t.teardown(process.exit);

  let colId: string | undefined;
  await generateRandomGeoFeatures(100, "test/data", "notRandom")
    .then((res) => {
      console.log("Generated collection: ", res.collectionId);
      t.pass("random generator works");
      colId = res.collectionId;
    })
    .catch((err) => {
      console.log("Error in random generator test");
      t.fail(err);
    });

  if (!colId) {
    t.fail("No collection id");
    t.end();
  }

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/collections/${colId}`,
  });
  console.log("deleteResponse", deleteResponse);
});
