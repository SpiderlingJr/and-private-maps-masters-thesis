// OGC Standard routes
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";

import appLinks from "../data/landingPage.js";
import conformance from "../data/conformance.js";

import {
  collIdSchema,
  collectionOptionsSchema,
  collIdFeatureIdSchema,
  collectionItemQuerySchema,
} from "../schema/httpRequestSchemas.js";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  options;

  // Registrate type provider as stated in https://www.fastify.io/docs/latest/Reference/Type-Providers/
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  //const pgConn = new PostGisConnection();
  //const featureValidator = new GeodataUpstreamHandler(pgConn);

  // Landing Page
  app.get("/", function (request, reply) {
    const response = {
      title: "AND Private Maps API Definition",
      description: "Some descriptive lorem ispum",
      links: appLinks,
    };

    reply.send(response);
  });
  app.get("/conformance", function (request, reply) {
    reply.send(conformance);
  });

  app.get("/collections", function (request, reply) {
    app.db
      .listCollections()
      .then((collections) => {
        reply.code(200);
        reply.send(collections);
      })
      .catch((err) => {
        reply.code(500).send({
          error: "Internal Server Error",
          message: `${err}`,
        });
      });
  });

  app.get(
    "/collections/:collId/items",
    {
      schema: {
        params: collIdSchema,
        querystring: collectionOptionsSchema,
      },
    },
    function (request, reply) {
      const collId = request.params.collId;

      const limit = request.query.limit;
      // TODO use those
      //const datetime = (request.query).datetime;
      //const bbox = request.query.bbox;

      app.db
        .getFeaturesByCollectionId(
          collId,
          Number(limit) ? Number(limit) : undefined
        )
        .then((response) => {
          reply.code(200);
          reply.send(response);
        })
        .catch((err) => {
          reply.code(404);
          reply.send(err);
        });
    }
  );

  // Returns collection info if collection exists, else 404
  app.get(
    "/collections/:collId",
    {
      schema: {
        params: collIdSchema,
      },
    },
    function (request, reply) {
      const { collId } = request.params;

      app.db
        .getCollectionById(collId)
        .then((response) => {
          if (response) {
            reply.code(200).send(response);
          } else {
            reply.code(404).send({
              error: "Not Found",
              message: `No collection with id ${collId}`,
            });
          }
        })
        .catch((err) => {
          if (err.message === "22P02") {
            reply.code(400).send({
              error: "Bad Request",
              message: err.cause + " " + collId,
            });
          } else if (err.message === "404") {
            reply.code(404).send({
              error: "Not Found",
              message: `No collection with id ${collId}`,
            });
          } else {
            reply.code(500).send({
              error: err.message,
            });
          }
        });
    }
  );

  app.get(
    "/collections/:collId/items/:featId",
    {
      schema: {
        params: collIdFeatureIdSchema,
        querystring: collectionItemQuerySchema,
      },
    },
    function (request, reply) {
      const { collId, featId } = request.params;

      app.db
        .getFeatureByCollectionIdAndFeatureId(collId, featId)
        .then((response) => {
          //const a = JSON.parse(response);
          if (response) {
            reply.code(200);
            reply.send(response);
          } else {
            reply.code(404).send({
              error: "Not Found",
              message: `No feature with id ${featId} in collection ${collId}`,
            });
          }
        })
        .catch((err) => {
          reply.code(500).send({
            error: "Internal Server Error",
            message: `Could not fetch feature with id ${featId} in collection ${collId}. Error: ${err}`,
          });
        });
    }
  );
}
