import { TransformOptions } from "readable-stream";
import { Transform, TransformCallback } from "stream";

interface GeoFeatureJSON {
  geometry: object;
  properties: object;
  colId: string;
}

/**
 * This transform streams takes a geofeature and parses it to a postgis compatible csv-format
 */
export class GeoJsonToCsvTransform extends Transform {
  colId: string;

  constructor(colId: string, options: TransformOptions = {}) {
    super({ ...options });
    this.colId = colId;
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = chunk.toString();
    const featureAsJSON = JSON.parse(line) as GeoFeatureJSON;
    featureAsJSON.colId = this.colId;

    const parsedLine = this.ndJSONtoCSV(featureAsJSON);
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
  private ndJSONtoCSV(ndj: GeoFeatureJSON): string {
    // build column values for db input
    const col_properties = ndj.properties;
    const col_geom = ndj.geometry;

    const csv_properties = JSON.stringify(col_properties).replaceAll('"', '""');
    const csv_geom = JSON.stringify(col_geom).replaceAll('"', '""');
    const csv_colid = JSON.stringify(ndj.colId);

    const csv_line =
      '"' + csv_geom + '";"' + csv_properties + '";' + csv_colid + "\n";
    console.log(csv_line);

    return csv_line;
  }
}
