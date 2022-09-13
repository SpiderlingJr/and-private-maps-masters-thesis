import { test } from "tap";
import { app } from "../src/app.js";

test('requests the "/" route', async (t) => {
  const response = await app.inject({
    method: "GET",
    url: "/",
    headers: {
      "content-type": "application/json",
    },
  });
  t.equal(response.statusCode, 400, "returns a status code of 400");
  t.same(JSON.parse(response.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "querystring must have required property 'foo'",
  });
});
