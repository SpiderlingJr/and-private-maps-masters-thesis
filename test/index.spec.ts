import { test } from "tap";
import { app } from "../src/app.js";
import FormData from "form-data";
import { createReadStream, readFileSync } from "fs";
import _ from "lodash";

import { awaitJobCompletion } from "./test_util/injects.js";
import generateRandomGeoFeatures from "./test_util/dataGenerator/spitRandomGeoms.js";
import { cropGeometryCoordinates } from "./test_util/cropGeometry.js";

test("general suite", async (t) => {
  t.teardown(process.exit);

  let randomTestDataPaths: Awaited<
    ReturnType<typeof generateRandomGeoFeatures>
  >;

  t.before(async () => {
    try {
      const testData = await generateRandomGeoFeatures(
        2,
        "test/data",
        "generalTestSuite"
      );
      randomTestDataPaths = testData;
    } catch (e) {
      console.log(e);
    }
  });

  t.test(
    "sub1: standard workflow on known data",
    async (standardWorkflowTest) => {
      // upload a valid ndjson file
      const form = new FormData();
      form.append(
        "validNdjsonData",
        createReadStream(`test/data/valid_ndjson_1.ndjson`)
      );

      const uploadResponse = await app.inject({
        method: "POST",
        url: "/data",
        payload: form,
        headers: form.getHeaders(),
      });
      standardWorkflowTest.equal(
        uploadResponse.statusCode,
        200,
        "uploading a valid ndjson file should return 200"
      );

      // get collection id of uploaded file, wait for completion if necessary
      const jobId = uploadResponse.body;
      const jobResponse = await awaitJobCompletion(jobId);
      const collectionId = JSON.parse(jobResponse.body).job_collection;

      // try to get a listing of collections
      const collectionInfoReponse = await app.inject({
        method: "GET",
        url: `/collections`,
      });
      standardWorkflowTest.equal(
        collectionInfoReponse.statusCode,
        200,
        "get collections should return 200"
      );

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
        `cid ${collectionId} should exist in collections after upload`
      );

      // TODO try to get data for that new collection
      // TODO check if the entries are correct
      const collectionResponse = await app.inject({
        method: "GET",
        url: `/collections/${collectionId}`,
      });
      standardWorkflowTest.equal(
        collectionResponse.statusCode,
        200,
        `get collection ${collectionId} should return 200`
      );

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
        "setting a valid style should return 200"
      );

      // try receiving mvt data out of bounds of style
      const invalidZoomLevel = 9;
      const oobMvtResponse = await app.inject({
        method: "GET",
        url: `/collections/${collectionId}/${invalidZoomLevel}/2/3.vector.pbf`,
      });
      standardWorkflowTest.equal(
        oobMvtResponse.statusCode,
        200,
        "getting mvt data out of bounds of style should return 200"
      );
      standardWorkflowTest.equal(
        oobMvtResponse.body.length,
        0,
        "getting mvt data out of bounds of style should return an empty response"
      );

      // try receiving data in bounds of style
      const okZoom = 8;
      const okMvtResponse = await app.inject({
        method: "GET",
        url: `/collections/${collectionId}/${okZoom}/1/0.vector.pbf`,
      });
      standardWorkflowTest.equal(
        okMvtResponse.statusCode,
        200,
        "getting mvt data in bounds of style should return 200"
      );
      standardWorkflowTest.afterEach(async () => {
        const delResponse = await app.inject({
          method: "DELETE",
          url: `/collections/${collectionId}`,
        });
        t.equal(
          delResponse.statusCode,
          200,
          `deleting collection ${collectionId} should return 200`
        );

        // TODO check if the collection is actually deleted
      });
    }
  );

  t.test(
    "sub2: requests on non-parametric routes",
    async (invariantRouteTest) => {
      invariantRouteTest.test(
        'requests the non-existing "/randomRoute" route',
        async (randomRouteTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/randomRoute",
            headers: {
              "content-type": "application/json",
            },
          });
          randomRouteTest.equal(
            response.statusCode,
            400,
            "requesting a non-existing route should return 400"
          );
          randomRouteTest.same(
            JSON.parse(response.body),
            {
              statusCode: 400,
              error: "Bad Request",
              message: "querystring must have required property 'foo'",
            },
            "requesting a non-existing route should return a helpful error message"
          );
          randomRouteTest.end();
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
            "requesting the landing page should return 200"
          );
          landingPageTest.end();
        }
      );

      invariantRouteTest.test(
        'request "/collections" route with no further information',
        async (listCollectionsTest) => {
          const response = await app.inject({
            method: "GET",
            url: "/collections",
          });
          listCollectionsTest.equal(
            response.statusCode,
            200,
            "requesting the list of collections should return 200"
          );
          listCollectionsTest.end();
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
          nonExistingCollectionIdTest.equal(
            response.statusCode,
            404,
            "requesting a non-existing collection should return 404"
          );
          nonExistingCollectionIdTest.same(
            JSON.parse(response.body),
            {
              //statusCode: 404,
              error: "Not Found",
              message: `No collection with id c8effd27-d965-472b-9940-47e2122a9ece`,
            },
            "requesting a non-existing collection should return a helpful error message"
          );
          nonExistingCollectionIdTest.end();
        }
      );

      invalidDataTest.test(
        'request "/collections/:cid" route with invalid collection id',
        async (malformedCollectionIdTest) => {
          const invalidCollId = "27-d965-472b-9940-47e2122a9ecd";
          const response = await app.inject({
            method: "GET",
            url: `/collections/${invalidCollId}`,
          });
          // TODO make this return 400, needs to be fixed in the server
          malformedCollectionIdTest.equal(
            response.statusCode,
            400,
            "requesting a collection with an invalid id should return 500"
          );
          // TODO fix the error message to be in line with a 400 response
          malformedCollectionIdTest.same(
            JSON.parse(response.body),
            {
              error: "Bad Request",
              message: `Invalid Syntax for UUID ${invalidCollId}`,
            },
            "requesting a collection with an invalid id should return a helpful error message"
          );
          malformedCollectionIdTest.end();
        }
      );

      invalidDataTest.test(
        'request "/post" route without multipart body',
        async (invalidMultipartPostTest) => {
          const response = await app.inject({
            method: "POST",
            url: "/data",
          });
          invalidMultipartPostTest.equal(
            response.statusCode,
            406,
            "requesting a non-multipart post should return 406"
          );
          invalidMultipartPostTest.same(
            JSON.parse(response.body),
            {
              statusCode: 406,
              code: "FST_INVALID_MULTIPART_CONTENT_TYPE",
              error: "Not Acceptable",
              message: "the request is not multipart",
            },
            "requesting a non-multipart post should return a helpful error message"
          );
          invalidMultipartPostTest.end();
        }
      );

      invalidDataTest.test(
        "try setting a valid style for non-existing collection",
        async (validStyleNonExistingCollectionTest) => {
          const nonExistingCollectionId =
            "7555e416-9a11-445b-b614-f12c1185ed63";
          const response = await app.inject({
            method: "POST",
            url: `/collections/${nonExistingCollectionId}/style`,
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
          validStyleNonExistingCollectionTest.equal(
            response.statusCode,
            404,
            "setting a valid style for a non-existing collection should return 404"
          );
          validStyleNonExistingCollectionTest.same(
            JSON.parse(response.body),
            {
              error: "Not Found",
              message: `No collection with id ${nonExistingCollectionId}`,
            },
            "setting a valid style for a non-existing collection should return a helpful error message"
          );
          validStyleNonExistingCollectionTest.end();
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
    cacheTest.equal(
      uploadResponse.statusCode,
      200,
      "uploading a valid ndjson file should return 200"
    );

    // get collection id of uploaded file, wait for completion if necessary
    const jobId = uploadResponse.body;
    const jobResponse = await awaitJobCompletion(jobId);
    const cid = JSON.parse(jobResponse.body).job_collection;
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
        minZoomBTmaxZoomTest.equal(
          response.statusCode,
          400,
          "setting a minZoom level bigger than maxZoom should return 400"
        );
        minZoomBTmaxZoomTest.same(
          JSON.parse(response.body),
          {
            error: "minZoom cannot be greater than maxZoom",
          },
          "setting a minZoom level bigger than maxZoom should return a helpful error message"
        );
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
        t.equal(
          response.statusCode,
          400,
          "setting a minZoom level exceeding 22 should return 400"
        );
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
        t.equal(
          cachePreRequest.statusCode,
          404,
          "cache shouldnt have an entry at that position on loadup"
        );

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

  t.todo("sub5: style tests", async (styleTest) => {
    //
  });

  t.test(
    "sub6: standard workflow on randomly generated geodata",
    async (randomDataStandardTest) => {
      /* The following tests work under the assumption of valid data being generated by the randomTestDataGenerator
       and are meant to further test the standard workflow under more realistic conditions
       * Upload test for original ndjson is obsolete, this is included in the randomTestDataGenerator test.
       TODO extend this suite to include tests that check if the service behaves correctly if the data is invalid
       TODO patch collection with patchable mutated properties
       TODO patch collection with patchable original properties
       TODO todo assert collection is patched correctly
      */

      const collectionId = randomTestDataPaths.collectionId;

      const mutatedDataNdjson = readFileSync(
        randomTestDataPaths.patchableMutatedPath
      ).toString();

      const mutatedForm = new FormData();
      mutatedForm.append(
        "validNdjsonData",
        createReadStream(randomTestDataPaths.patchableMutatedPath)
      );

      const mutatedPatchRes = await app.inject({
        method: "PATCH",
        url: `/data`,
        payload: mutatedForm,
        headers: mutatedForm.getHeaders(),
      });
      randomDataStandardTest.equal(
        mutatedPatchRes.statusCode,
        200,
        "patching a valid ndjson file should return 200"
      );
      // wait a second
      await awaitJobCompletion(mutatedPatchRes.body);

      // get the mutated data from db
      const mutatedDataRes = await app.inject({
        method: "GET",
        url: `/collections/${collectionId}/items`,
      });

      const mutatedData = JSON.parse(mutatedDataRes.body);

      const mutatedCompareMap = new Map();
      const ndjArray = mutatedDataNdjson.split("\n");
      ndjArray.forEach((ndj) => {
        const asJSON = JSON.parse(ndj);
        mutatedCompareMap.set(asJSON.featId, asJSON.geometry);
      });

      let allEqual = true;
      mutatedData.forEach((feature) => {
        const dbGeom = feature.Features_geom;
        const localGeom = mutatedCompareMap.get(feature.Features_feature_id);
        cropGeometryCoordinates(localGeom);
        if (!_.isEqual(dbGeom, localGeom)) {
          console.log("Mutated data is not equal to the data in the db!");
          console.log("croppedLocal: ", localGeom);
          console.log("DB: ", dbGeom);
          allEqual = false;
        }
      });
      randomDataStandardTest.equal(
        allEqual,
        true,
        "mutated data should be equal to the data in the db"
      );

      randomDataStandardTest.end();
      randomDataStandardTest.afterEach(async () => {
        await app.inject({
          method: "DELETE",
          url: `/collections/${randomTestDataPaths.collectionId}`,
        });
        // TODO check if the collection is actually deleted
      });
    }
  );
});
