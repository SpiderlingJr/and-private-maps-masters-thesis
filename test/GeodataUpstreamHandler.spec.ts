import { test } from "tap";
import { GeodataUpstreamHandler } from "../src/GeodataUpstreamHandler.js";
import { PostGisConnection } from "../src/PostGisConnection.js";

test("validation pipeline passthrough on valid data", async (t) => {
  const valid_file = "test/data/valid_ndjson.ndjson";
  const uuid_for_valid = "ddedecf6-4ae9-11ed-b878-0242ac120002";
  const dbConn = new PostGisConnection();
  const handler = new GeodataUpstreamHandler(dbConn);

  const resolving_promise = handler.validateAndUploadGeoFeature(
    valid_file,
    uuid_for_valid,
    false
  );

  t.resolves(resolving_promise);

  t.afterEach(() => {
    dbConn.dropFeaturesByColid(uuid_for_valid);
  });
});

test("validation pipeline error on invalid data", async (t) => {
  const uuid_for_invalid = "fc738c4e-4ae9-11ed-b878-0242ac120002";
  const invalid_file = "test/data/invalid_ndjson.ndjson";
  const dbConn = new PostGisConnection();
  const handler = new GeodataUpstreamHandler(dbConn);
  const rejecting_promise = handler.validateAndUploadGeoFeature(
    invalid_file,
    uuid_for_invalid,
    false
  );

  t.rejects(rejecting_promise);

  t.afterEach(() => {
    dbConn.dropFeaturesByColid(uuid_for_invalid);
  });
});