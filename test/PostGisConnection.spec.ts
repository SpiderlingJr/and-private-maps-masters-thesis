import { test } from "tap";
import { PostGisConnection } from "../src/PostGisConnection.js";

test("add new job, then remove it", async (t) => {
  const pgconn = new PostGisConnection();

  const entriesBeforeNewJobRes = await pgconn.countTableEntries("jobs");
  const preJobs = entriesBeforeNewJobRes.rows[0].count;

  const newJob = await pgconn.createNewJob();

  const entriesAfterNewJobRes = await pgconn.countTableEntries("jobs");
  const postJobs = entriesAfterNewJobRes.rows[0].count;

  const entryDiff = postJobs - preJobs;
  t.equal(entryDiff, 1);

  await pgconn.dropJob(newJob);

  const entriesAfterRemovingNewJob = await pgconn.countTableEntries("jobs");

  const postDelJobs = entriesAfterRemovingNewJob.rows[0].count;
  t.equal(preJobs, postDelJobs);
});

test("generate new collection, then remove it", async (t) => {
  // obsolete, as scenario is identical to job-test
});
test("upload valid_file_1, then delete those from db.", async (t) => {
  // the collection id of the tests files, in order to remove them later.
  const testColId = "d1df240e-ab55-4d3b-a59e-2daac18f1ad2";
  const validFile1 = "test/data/valid_csv_1.csv";
  const numLinesInValid1 = 7;

  const pgconn = new PostGisConnection();

  const preUploadRes = await pgconn.countTableEntries("features");
  const numFeaturesPreUpload = preUploadRes.rows[0].count;

  await pgconn.uploadDataFromCsv(validFile1);

  const postUploadRes = await pgconn.countTableEntries("features");
  const numFeaturesPostUpload: number = postUploadRes.rows[0].count;

  const numFeaturesDiff = numFeaturesPostUpload - numFeaturesPreUpload;
  t.equal(numFeaturesDiff, numLinesInValid1);

  // Remove inserted lines
  t.afterEach(async () => {
    await pgconn.dropFeaturesByColid(testColId);

    const postDeleteRes = await pgconn.countTableEntries("features");
    const numFeaturesPostDelete: number = postDeleteRes.rows[0].count;

    t.equal(numFeaturesPreUpload, numFeaturesPostDelete);
  });
});
