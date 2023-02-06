import { TransformOptions } from "readable-stream";
import { Transform, TransformCallback } from "stream";

interface GeoFeatureJSON {
  geometry: object;
  properties: object;
  colId: string;
  featId: string;
}

export type UpdateStrategy = "POST" | "UPDATE";

/**
 * This transform streams takes a geofeature line and parses it to a postgis compatible csv-format
 * @param colId: collection id to be added to the features
 * @param options
 * @param updateStrategy: if POST, the collection is assumed to be new and the colId is added to the feature
 *                        if UPDATE, the collection already exists and requires an existing feature id to be included in
 *                        order to be found in the db
 */
export class GeoJsonToCsvTransform extends Transform {
  colId: string;
  updateStrategy: UpdateStrategy;

  constructor(
    colId: string,
    options: TransformOptions = {},
    updateStrategy: UpdateStrategy = "POST"
  ) {
    super({ ...options });
    this.colId = colId;
    this.updateStrategy = updateStrategy;
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = chunk.toString();
    const featureAsJSON = JSON.parse(line) as GeoFeatureJSON;

    featureAsJSON.colId = this.colId;

    const parsedLine = this.geoNdJSONtoCSV(featureAsJSON, this.updateStrategy);
    this.push(parsedLine);
    callback();
  }
  _flush(callback: TransformCallback): void {
    callback();
  }

  /**
   * Converts a valid ndjson geofeature to a csv-line that is compatible with pg-copy-streams
   * @param ndj GeoJSON Feature
   * @returns csv line, newline terminated.
   */
  private geoNdJSONtoCSV(
    ndj: GeoFeatureJSON,
    strategy: UpdateStrategy
  ): string {
    // build column values for db input
    const col_properties = ndj.properties;
    const col_geom = ndj.geometry;

    const csv_properties = JSON.stringify(col_properties).replaceAll('"', '""');
    const csv_geom = JSON.stringify(col_geom).replaceAll('"', '""');

    const csv_colid = JSON.stringify(ndj.colId);

    if (strategy === "POST") {
      const csv_line =
        '"' + csv_geom + '";"' + csv_properties + '";' + csv_colid + "\n";

      return csv_line;
    } else if (strategy === "UPDATE") {
      if (!ndj.featId) throw new Error("field featId is required for update");

      console.log(ndj);
      const csv_featId = JSON.stringify(ndj.featId);

      const csv_line =
        '"' +
        csv_geom +
        '";"' +
        csv_properties +
        '";' +
        csv_colid +
        '";' +
        csv_featId +
        "\n";

      return csv_line;
    } else {
      throw new Error("Invalid update strategy");
    }
  }
}
