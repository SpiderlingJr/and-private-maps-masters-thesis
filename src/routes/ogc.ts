// OGC Standard routes
import { FastifyPluginOptions } from "fastify";
import { FastifyInstance } from "fastify";

import appLinks from "../data/landingPage.js";
import conformance from "../data/conformance.js";

import { PostGisConnection } from "../util/PostGisConnection.js";
import { GeodataUpstreamHandler } from "../util/GeodataUpstreamHandler.js";

import {
  styleSchema,
  collIdSchema,
  collIdZXYSchema,
  collectionOptionsSchema,
  jobIdSchema,
  collIdFeatureIdSchema,
  collectionItemQuerySchema,
} from "../schema/httpRequestSchemas.js";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

export default async function (
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Registrate type provider as stated in https://www.fastify.io/docs/latest/Reference/Type-Providers/
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  const pgConn = new PostGisConnection();
  const featureValidator = new GeodataUpstreamHandler(pgConn);

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
    pgConn
      .listCollections()
      .then((collections) => {
        reply.code(200);
        reply.send(collections);
      })
      .catch((err) => {
        reply.code(500);
        reply.send({ description: "Could not fetch collections." });
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

      pgConn
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

      pgConn
        .getCollectionById(collId)
        .then((response) => {
          if (response.length > 0) {
            reply.code(200).send(response);
          } else {
            reply.code(404).send({
              statusCode: 404,
              error: "Not Found",
              message: "No such collection",
            });
          }
        })
        .catch((err) => {
          reply.code(404).send(err);
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

      pgConn
        .getFeatureByCollectionIdAndFeatureId(collId, featId)
        .then((response) => {
          //const a = JSON.parse(response);
          if (response.length > 0) {
            reply.code(200);
            reply.send(response);
          } else {
            reply.code(404).send();
          }
        })
        .catch((err) => {
          reply.code(400);
          reply.send(err);
        });
    }
  );
}
