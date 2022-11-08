import { Type } from "@sinclair/typebox";

const collIdSchema = Type.Object({
  collId: Type.String(),
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

const getCollectionOptionsSchema = Type.Object({
  limit: Type.Optional(Type.String()),
  datetime: Type.Optional(Type.String()),
  bbox: Type.Optional(Type.String()),
});
export {
  styleSchema,
  collIdSchema,
  collIdZXYSchema,
  getCollectionOptionsSchema,
};
