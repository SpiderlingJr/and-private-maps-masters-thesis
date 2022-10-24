/*
import { test } from "tap";
import { PostGisConnection } from "src/util/PostGisConnection.js";

test("add new job, then remove it", async (t) => {
  const pgconn = new PostGisConnection();

  const jobs_t0 = await pgconn.countJobs();

  const newJob = await pgconn.createNewJob();

  const jobs_t1 = await pgconn.countJobs();

  const entryDiff = jobs_t1 - jobs_t0;
  t.equal(entryDiff, 1);

  await pgconn.dropJob(newJob);

  const jobs_t2 = await pgconn.countJobs();

  t.equal(jobs_t0, jobs_t2);
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

  const features_t0 = await pgconn.countFeatures();

  await pgconn.pgCopyInsert(validFile1);

  const features_t1 = await pgconn.countFeatures();

  const numFeaturesDiff = features_t1 - features_t0;
  t.equal(numFeaturesDiff, numLinesInValid1);

  // Remove inserted lines
  t.afterEach(async () => {
    await pgconn.dropFeaturesByColid(testColId);

    const features_t2 = await pgconn.countFeatures();

    t.equal(features_t0, features_t2);
  });
});

*/
