import Ajv from "ajv";
import { TransformOptions } from "readable-stream";
import { Transform, TransformCallback } from "stream";
import * as path from "path";
import { readFileSync } from "fs";

const featureSchemaPath = path.join(process.cwd(), "src/schema/Feature.json");

export class GeoValidationTransform extends Transform {
  ajv: Ajv.default;
  featureSchema: JSON;
  validate;

  constructor(options: TransformOptions = {}) {
    super({ ...options });

    this.ajv = new Ajv.default();
    this.featureSchema = this.loadFeatureSchema();
    this.validate = this.ajv.compile(this.featureSchema);
  }

  /**
   * Loads the ajv-compatible schema for a GeoJSON Feature.
   * @param file Path to geojson feature schema
   * @returns JSON obj schema
   */
  private loadFeatureSchema(file: string = featureSchemaPath): JSON {
    const fileData = readFileSync(file, "utf-8");
    return JSON.parse(fileData);
  }

  private isValidGeoJsonFeature(line: string): boolean {
    try {
      const json_obj = JSON.parse(line);
      const valid = this.validate(json_obj);

      return valid;
    } catch (e) {
      console.log("Couldnt parse JSON File \n" + e);
      return false;
    }
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    if (this.isValidGeoJsonFeature(chunk.toString())) {
      this.push(chunk);
      callback();
    } else {
      this.emit("error", "Invalid feature in line " + chunk.toString());
    }
  }

  _flush(callback: TransformCallback): void {
    callback();
  }
}
