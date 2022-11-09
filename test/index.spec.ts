import { test } from "tap";
import { app } from "../src/app.js";
import FormData from "form-data";
import { createReadStream } from "fs";
// TODO inject some test data for each manipulation
// TODO test-collection for each test case / sequence

//TODO
test("standard workflow", async (t) => {
  // TODO upload a valid ndjson file
  const form = new FormData();
  form.append("valid_data", createReadStream(`test/data/valid_ndjson.ndjson`));

  const uploadResponse = await app.inject({
    method: "POST",
    url: "/data",
    payload: form,
    headers: form.getHeaders(),
  });

  t.equal(uploadResponse.statusCode, 200);

  // TODO get collection id of uploaded file
  const jid = uploadResponse.body;
  console.log("Jid", jid);
  // TODO try to get data for that collection
  // TODO try setting a style
  // TODO try receiving data out of bounds of style
  // TODO try receivin data in bounds of style
  // TODO try deleting the collection
});
test('requests the "/randomRoute" route', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/randomRoute",
    headers: {
      "content-type": "application/json",
    },
    //query: { foo: "1", bar: "baaa" },
  });
  t.equal(response.statusCode, 400, "returns a status code of 400");
  t.same(JSON.parse(response.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "querystring must have required property 'foo'",
  });
});

test('requests the "/" route (Landing Page)', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/",
    headers: {
      "content-type": "application/json",
    },
  });
  t.equal(response.statusCode, 200, "returns a status code of 200");
});

test('request "/collections" route with no further information', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/collections",
  });
  t.equal(response.statusCode, 200);
});

test('request "/collections/:cid" route with valid collection id', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/collections/b8effd27-d965-472b-9940-47e2122a9ece",
  });
  t.equal(response.statusCode, 200);
});

test('request "/collections/:cid" route with non-existing collection id', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/collections/c8effd27-d965-472b-9940-47e2122a9ece",
  });
  t.equal(response.statusCode, 404);
  t.same(JSON.parse(response.body), {
    statusCode: 404,
    error: "Not Found",
    message: "No such collection",
  });
});

test('request "/collections/:cid" route with invalid collection id', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/collections/27-d965-472b-9940-47e2122a9ecd",
  });
  t.equal(response.statusCode, 404);
  t.same(JSON.parse(response.body), {
    statusCode: 404,
    code: "22P02",
    error: "Not Found",
    message:
      'invalid input syntax for type uuid: "27-d965-472b-9940-47e2122a9ecd"',
  });
});

test('request "/post" route with ndjson file as multipart body', async (t) => {
  t.todo("implement this");
});

test('request "/post" route without multipart body', async (t) => {
  const response = await app.inject({
    method: "POST",
    url: "/data",
  });
  t.equal(response.statusCode, 406);
  t.same(JSON.parse(response.body), {
    statusCode: 406,
    code: "FST_INVALID_MULTIPART_CONTENT_TYPE",
    error: "Not Acceptable",
    message: "the request is not multipart",
  });
});

test("try setting a valid style for an existing collection", async (t) => {
  const response = await app.inject({
    method: "POST",
    url: "/collections/7555e516-9a11-445b-b614-f12c1185ed62/style",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      Style: {
        minZoom: 3,
        maxZoom: 4,
      },
    },
  });
  t.equal(response.statusCode, 200);
});

test("try setting a valid style for non-existing collection", async (t) => {
  const response = await app.inject({
    method: "POST",
    url: "/collections/7555e416-9a11-445b-b614-f12c1185ed63/style",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      Style: {
        minZoom: 7,
        maxZoom: 12,
      },
    },
  });
  t.equal(response.statusCode, 404);
  t.same(JSON.parse(response.body), {
    statusCode: 404,
    error: "Not Found",
    message: "No such collection",
  });
});

test("try setting a minZoom level bigger than maxZoom on an existing collection", async (t) => {
  const response = await app.inject({
    method: "POST",
    url: "/collections/7555e416-9a11-445b-b614-f12c1185ed63/style",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      Style: {
        minZoom: 12,
        maxZoom: 4,
      },
    },
  });
  t.equal(response.statusCode, 400);
  t.same(JSON.parse(response.body), {
    error: "minZoom cannot be greater than maxZoom",
  });
});

test("try setting a minZoom level exceeding 22 (maximum mvt depth)", async (t) => {
  const response = await app.inject({
    method: "POST",
    url: "/collections/7555e416-9a11-445b-b614-f12c1185ed63/style",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      Style: {
        minZoom: 24,
        maxZoom: 4,
      },
    },
  });
  t.equal(response.statusCode, 400);
  t.same(JSON.parse(response.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body/Style/minZoom must be <= 22",
  });
});

// Cache tests
test("test if requested pbfs are properly stored in cache", async (t) => {
  // Request any tile
  const pbf_request =
    "/collections/7555e516-9a11-445b-b614-f12c1185ed62/3/3/2.vector.pbf";
  const cache_request = "/cache/3/3/2";

  // assert cache doesnt have an entry at that position on loadup
  const cachePreRequest = await app.inject({
    method: "GET",
    url: cache_request,
  });
  t.equal(cachePreRequest.statusCode, 404);

  const response = await app.inject({
    method: "GET",
    url: pbf_request,
  });

  const cachePostRequest = await app.inject({
    method: "GET",
    url: cache_request,
  });
  t.equal(cachePostRequest.statusCode, 200);
  t.equal(cachePostRequest.body, response.body);
});

test("cache is invalidated after a style post", async (t) => {
  //
});
