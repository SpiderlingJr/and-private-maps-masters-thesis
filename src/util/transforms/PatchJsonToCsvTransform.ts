import { TransformOptions } from "readable-stream";
import { Transform, TransformCallback } from "stream";

interface PatchFeatureJSON {
  FeatureId: string;
  properties: object;
}

/**
 * This transform streams takes a geofeature and parses it to a postgis compatible csv-format
 */
export class PatchJsonToCsvTransform extends Transform {
  constructor(options: TransformOptions = {}) {
    super({ ...options });
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = chunk.toString();
    const featureAsJSON = JSON.parse(line) as PatchFeatureJSON;

    const parsedLine = this.patchNdJsonToCSV(featureAsJSON);
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
  private patchNdJsonToCSV(ndj: PatchFeatureJSON): string {
    // build column values for db input
    const col_properties = ndj.properties;
    const col_id = ndj.FeatureId;

    const csv_properties = JSON.stringify(col_properties).replaceAll('"', '""');
    //const csv_featureId = JSON.stringify(col_id).replaceAll('"', '""');

    const csv_line =
      '"' +
      col_id +
      '";"' +
      csv_properties +
      '";"{""type"":""Point"",""coordinates"":[0,0]}"\n';

    console.log(csv_line);

    return csv_line;
  }
}
