import { test } from "tap";
import { app } from "../src/app.js";
import FormData from "form-data";
import { createReadStream } from "fs";

import { waitForUploadJobCompletion } from "./test_util/injects.js";

test("general suite", async (t) => {
  t.beforeEach(async () => {
    // TODO Establish test data for subsequent tests
  });
  t.teardown(process.exit);

  t.test("sub1: standard workflow", async (standardWorkflowTest) => {
    standardWorkflowTest.plan(8);

    // upload a valid ndjson file
    const form = new FormData();
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
    standardWorkflowTest.equal(uploadResponse.statusCode, 200);

    // get collection id of uploaded file, wait for completion if necessary
    const jobId = uploadResponse.body;
    const jobResponse = await waitForUploadJobCompletion(jobId);
    const collectionId = JSON.parse(jobResponse.body).job_collection;

    // try to get a listing of collections
    const collectionInfoReponse = await app.inject({
      method: "GET",
      url: `/collections`,
    });
    standardWorkflowTest.equal(collectionInfoReponse.statusCode, 200);

    // assert the recently published collection is listed in the collections
    const collectionInfo = JSON.parse(collectionInfoReponse.body);
    let collectionExists = false;
    for (const col of collectionInfo) {
      if (col["coll_id"] == collectionId) {
        collectionExists = true;
        break;
      }
    }
    standardWorkflowTest.equal(
      true,
      collectionExists,
      `cid ${collectionId} should be in collections, but is not`
    );

    // TODO try to get data for that new collection
    // TODO check if the entries are correct
    const collectionResponse = await app.inject({
      method: "GET",
      url: `/collections/${collectionId}`,
    });
    standardWorkflowTest.equal(collectionResponse.statusCode, 200);

    // try setting a valid style
    const styleResponse = await app.inject({
      method: "POST",
      url: `/collections/${collectionId}/style`,
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
    standardWorkflowTest.equal(
      styleResponse.statusCode,
      200,
      "set valid styleset response -> ok"
    );

    // try receiving mvt data out of bounds of style
    const invalidZoomLevel = 9;
    const oobMvtResponse = await app.inject({
      method: "GET",
      url: `/collections/${collectionId}/${invalidZoomLevel}/2/3.vector.pbf`,
    });
    standardWorkflowTest.equal(oobMvtResponse.statusCode, 200);
    standardWorkflowTest.equal(oobMvtResponse.body.length, 0);

    // try receiving data in bounds of style
    const okZoom = 8;
    const okMvtResponse = await app.inject({
      method: "GET",
      url: `/collections/${collectionId}/${okZoom}/1/0.vector.pbf`,
    });
    standardWorkflowTest.equal(okMvtResponse.statusCode, 200);

    standardWorkflowTest.afterEach(async () => {
      const delResponse = await app.inject({
        method: "DELETE",
        url: `/collections/${collectionId}`,
      });
      t.equal(delResponse.statusCode, 200);

      // TODO check if the collection is actually deleted
    });
  });

  t.test(
    "sub2: requests on non-parametric routes",
    async (invariantRouteTest) => {
      invariantRouteTest.test(
        'requests the "/randomRoute" route',
        async (randomRouteTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/randomRoute",
            headers: {
              "content-type": "application/json",
            },
            //query: { foo: "1", bar: "baaa" },
          });
          randomRouteTest.equal(
            response.statusCode,
            400,
            "returns a status code of 400"
          );
          randomRouteTest.same(JSON.parse(response.body), {
            statusCode: 400,
            error: "Bad Request",
            message: "querystring must have required property 'foo'",
          });
        }
      );

      invariantRouteTest.test(
        'requests the "/" route (Landing Page)',
        async (landingPageTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/",
            headers: {
              "content-type": "application/json",
            },
          });
          landingPageTest.equal(
            response.statusCode,
            200,
            "returns a status code of 200"
          );
        }
      );

      invariantRouteTest.test(
        'request "/collections" route with no further information',
        async (listCollectionsTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/collections",
          });
          listCollectionsTest.equal(response.statusCode, 200);
        }
      );
    }
  );

  t.test(
    "sub3: requests on non-existing or invalid data",
    async (invalidDataTest) => {
      invalidDataTest.test(
        'request "/collections/:cid" route with non-existing collection id',
        async (nonExistingCollectionIdTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/collections/c8effd27-d965-472b-9940-47e2122a9ece",
          });
          nonExistingCollectionIdTest.equal(response.statusCode, 404);
          nonExistingCollectionIdTest.same(JSON.parse(response.body), {
            //statusCode: 404,
            error: "Not Found",
            message: `No collection with id c8effd27-d965-472b-9940-47e2122a9ece`,
          });
        }
      );

      invalidDataTest.test(
        'request "/collections/:cid" route with invalid collection id',
        async (malformedCollectionIdTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/collections/27-d965-472b-9940-47e2122a9ecd",
          });
          malformedCollectionIdTest.equal(response.statusCode, 500);
          malformedCollectionIdTest.same(JSON.parse(response.body), {
            error: "Internal Server Error",
          });
        }
      );

      invalidDataTest.test(
        'request "/post" route without multipart body',
        async (invalidMultipartPostTest) => {
          const response = await app.inject({
            method: "POST",
            url: "/data",
          });
          invalidMultipartPostTest.equal(response.statusCode, 406);
          invalidMultipartPostTest.same(JSON.parse(response.body), {
            statusCode: 406,
            code: "FST_INVALID_MULTIPART_CONTENT_TYPE",
            error: "Not Acceptable",
            message: "the request is not multipart",
          });
        }
      );

      invalidDataTest.test(
        "try setting a valid style for non-existing collection",
        async (validStyleNonExistingCollectionTest) => {
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
          validStyleNonExistingCollectionTest.equal(response.statusCode, 404);
          validStyleNonExistingCollectionTest.same(JSON.parse(response.body), {
            error: "Not Found",
            message: `No collection with id 7555e416-9a11-445b-b614-f12c1185ed63`,
          });
        }
      );
    }
  );

  t.test("sub4: caching tests", async (cacheTest) => {
    // These tests are required to work independent of applied cache strategy

    // upload a valid ndjson file
    const form = new FormData();
    form.append(
      "valid_data",
      createReadStream(`test/data/germany_outline.ndjson`)
    );

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/data",
      payload: form,
      headers: form.getHeaders(),
    });
    cacheTest.equal(uploadResponse.statusCode, 200);

    // get collection id of uploaded file, wait for completion if necessary
    const jobId = uploadResponse.body;
    const jobResponse = await waitForUploadJobCompletion(jobId);
    const cid = JSON.parse(jobResponse.body).job_collection;
    console.log("cid: ", cid);

    // TODO move this to a seperate test subsuite
    cacheTest.test(
      "try setting a minZoom level bigger than maxZoom on an existing collection",
      async (minZoomBTmaxZoomTest) => {
        const response = await app.inject({
          method: "POST",
          url: `/collections/${cid}/style`,
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
        minZoomBTmaxZoomTest.equal(response.statusCode, 400);
        minZoomBTmaxZoomTest.same(JSON.parse(response.body), {
          error: "minZoom cannot be greater than maxZoom",
        });
      }
    );

    // TODO move this to a seperate test subsuite
    cacheTest.test(
      "try setting a minZoom level exceeding 22 (maximum mvt depth)",
      async (t) => {
        const response = await app.inject({
          method: "POST",
          url: `/collections/${cid}/style`,
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
      }
    );

    // Cache tests
    cacheTest.test(
      "test if requested pbfs are properly stored in cache",
      async (t) => {
        // Request any tile
        const pbf_request = `/collections/${cid}/3/4/2.vector.pbf`;
        const cache_request = "/cache/3/4/2";

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
        t.equal(
          cachePostRequest.statusCode,
          200,
          "couldnt receive cached tile"
        );
        /*t.equal(
          cachePostRequest.body,
          response.body,
          `${cachePostRequest.body} != ${response.body}`
        );*/
      }
    );

    cacheTest.todo("cache is invalidated after a style post", async (t) => {
      //
    });

    cacheTest.todo("delete collection after sub4 is done");
    // TODO this (I promise it works)
  });

  t.test("sub5: style tests", async (styleTest) => {
    //
  });
});
