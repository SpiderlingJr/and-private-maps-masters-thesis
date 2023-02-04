import { Type } from "@sinclair/typebox";

const collIdSchema = Type.Object({
  collId: Type.String(),
});

const jobIdSchema = Type.Object({
  jobId: Type.String(),
});

const collIdFeatureIdSchema = Type.Object({
  collId: Type.String(),
  featId: Type.String(),
});

const styleSchema = Type.Object({
  Style: Type.Object({
    minZoom: Type.Integer({ minimum: 0, maximum: 22, default: 0 }),
    maxZoom: Type.Integer({ minimum: 0, maximum: 22, default: 22 }),
  }),
});

const collIdZXYSchema = Type.Object({
  collId: Type.String(),
  x: Type.Integer(),
  y: Type.Integer(),
  z: Type.Integer(),
});

const xyzSchema = Type.Object({
  x: Type.Integer(),
  y: Type.Integer(),
  z: Type.Integer(),
});

const collectionOptionsSchema = Type.Object({
  limit: Type.Optional(Type.String()),
  datetime: Type.Optional(Type.String()),
  bbox: Type.Optional(Type.String()),
});

const collectionItemQuerySchema = Type.Object({
  querystring: Type.Object({
    limit: Type.Optional(Type.String()),
    datetime: Type.Optional(Type.String()),
    bbox: Type.Optional(Type.String()),
  }),
});

export {
  xyzSchema,
  jobIdSchema,
  styleSchema,
  collIdSchema,
  collIdZXYSchema,
  collectionOptionsSchema,
  collectionItemQuerySchema,
  collIdFeatureIdSchema,
};
