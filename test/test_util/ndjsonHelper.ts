import { Feature, Geometry } from "@turf/turf";

type ndjsonSchema = {
  featId?: string;
  type: "Feature";
  properties: object;
  geometry: object;
};
interface NdjsonHelper {
  generateNdjson: (ndjsonOptions: ndjsonSchema) => string;
  revertNdjson: (ndjson: string) => ndjsonSchema;
}

export const ndjsonHelper: NdjsonHelper = {
  generateNdjson: (ndjsonOptions: ndjsonSchema) => {
    const { featId, properties, geometry } = ndjsonOptions;
    const ndjson = {
      featId,
      properties,
      geometry,
    };
    return JSON.stringify(ndjson);
  },
  revertNdjson: (ndjson: string) => {
    return JSON.parse(ndjson) satisfies ndjsonSchema;
  },
};
