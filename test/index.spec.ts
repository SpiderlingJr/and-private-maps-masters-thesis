import tap, { test } from "tap";
import { app } from "../src/app.js";
import FormData from "form-data";
import { createReadStream } from "fs";
import { styleSchema } from "../src/schema/httpRequestSchemas.js";
import { JobState } from "../src/entities/jobs.js";
import LightMyRequest from "light-my-request";
import { PostGisConnection } from "../src/util/PostGisConnection.js";
// TODO inject some test data for each manipulation
// TODO test-collection for each test case / sequence

//TODO
test("suite", async (t) => {
  t.teardown(process.exit);
  t.test("sub1: standard workflow", async (sub1) => {
    sub1.plan(6);

    async function waitForUploadJobCompletion(
      jobId: string
    ): Promise<LightMyRequest.Response> {
      function delay(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
      }
      sub1;
      async function getJobState() {
        const jobResponse = await app.inject({
          method: "GET",
          url: `/job/${jobId}`,
        });
        if (JSON.parse(jobResponse.body).job_state === JobState.PENDING)
          throw new Error("PENDING");
        return jobResponse;
      }
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const retryOperation = (operation, delay, retries) =>
        new Promise((resolve, reject) => {
          return operation()
            .then(resolve)
            .catch((reason) => {
              if (retries > 0) {
                return wait(delay)
                  .then(retryOperation.bind(null, operation, retries - 1))
                  .then(resolve)
                  .catch(reject);
              }
              return reject(reason);
            });
        });

      const jobResponse = retryOperation(
        getJobState,
        1000,
        5
      ) as Promise<LightMyRequest.Response>;
      return jobResponse;
    }
    // upload a valid ndjson file
    const form = new FormData();
    form.append(
      "valid_data",
      createReadStream(`test/data/valid_ndjson.ndjson`)
    );

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/data",
      payload: form,
      headers: form.getHeaders(),
    });
    sub1.equal(uploadResponse.statusCode, 200);

    // get collection id of uploaded file, wait for completion if necessary
    const jobId = uploadResponse.body;
    const jobResponse = await waitForUploadJobCompletion(jobId);
    const cid = JSON.parse(jobResponse.body).job_collection;

    // TODO assert /collections contains an entry for cid
    const collectionInfoReponse = await app.inject({
      method: "GET",
      url: `/collections`,
    });
    //console.log(collectionInfoReponse.body);
    const cInfo = JSON.parse(collectionInfoReponse.body)[0];
    //t.equal(true, cid in cInfo, "collId should be in collection info");
    sub1.equal(collectionInfoReponse.statusCode, 200);

    // TODO try to get data for that new collection
    // TODO check if the entries are correct
    const collectionResponse = await app.inject({
      method: "GET",
      url: `/collections/${cid}`,
    });
    sub1.equal(collectionResponse.statusCode, 200);

    // try setting a valid style
    const styleResponse = await app.inject({
      method: "POST",
      url: `/collections/${cid}/style`,
      headers: {
        "content-type": "application/json",
      },
      payload: {
        Style: {
          minZoom: 6,
          maxZoom: 8,
        },
      },
    });
    sub1.equal(
      styleResponse.statusCode,
      200,
      "set valid styleset response -> ok"
    );

    // try receiving mvt data out of bounds of style
    const badZoom = 9;
    const oobMvtResponse = await app.inject({
      method: "GET",
      url: `/collections/${cid}/${badZoom}/2/3.vector.pbf`,
    });
    sub1.equal(styleResponse.statusCode, 200);

    // try receiving data in bounds of style
    const okZoom = 8;
    const okMvtResponse = await app.inject({
      method: "GET",
      url: `/collections/${cid}/${okZoom}/2/3.vector.pbf`,
    });
    sub1.equal(okMvtResponse.statusCode, 200);

    // TODO try deleting the collection
    sub1.afterEach(async () => {
      const delResponse = await app.inject({
        method: "DELETE",
        url: `/collections/${cid}`,
      });
      t.equal(delResponse.statusCode, 200);
    });
  });

  t.test("sub2: requests on non-parametric routes", async (sub2) => {
    sub2.test('requests the "/randomRoute" route', async (t) => {
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

    sub2.test('requests the "/" route (Landing Page)', async (t) => {
      const response = await app.inject({
        method: "GET",
        url: "/",
        headers: {
          "content-type": "application/json",
        },
      });
      t.equal(response.statusCode, 200, "returns a status code of 200");
    });

    sub2.test(
      'request "/collections" route with no further information',
      async (t) => {
        const response = await app.inject({
          method: "GET",
          url: "/collections",
        });
        t.equal(response.statusCode, 200);
      }
    );
  });

  t.test("sub3: requests on non-existing or invalid data", async (sub3) => {
    sub3.test(
      'request "/collections/:cid" route with non-existing collection id',
      async (t) => {
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
      }
    );

    sub3.test(
      'request "/collections/:cid" route with invalid collection id',
      async (t) => {
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
      }
    );

    sub3.test('request "/post" route without multipart body', async (t) => {
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

    sub3.test(
      "try setting a valid style for non-existing collection",
      async (t) => {
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
      }
    );
  });
  /*
  t.test("sub4: caching tests", async(sub4) => {
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
  })*/
});
