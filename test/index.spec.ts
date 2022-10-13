import { test } from "tap";
import { app } from "../src/app.js";

test('requests the "/" route', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/",
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

test('request "/get" route with valid collection id', async (t) => {
  t.todo("implement this");
});

test('request "/get" route with no further information', async (t) => {
  t.todo("implement this");
});

test('request "/get" route with invalid collection id', async (t) => {
  t.todo("implement this");
});

test('request "/post" route with ndjson fily as multipart body', async (t) => {
  t.todo("implement this");
});

test('request "/post" route without multipart body', async (t) => {
  t.todo("implement this");
});
