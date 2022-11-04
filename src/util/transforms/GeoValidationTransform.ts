import Ajv from "ajv";
import { TransformOptions } from "readable-stream";
import { Transform, TransformCallback } from "stream";
import * as path from "path";
import { readFileSync } from "fs";

type Schema = "GeoValidation" | "PatchValidation";

const featureSchemaPath = path.join(process.cwd(), "src/schema/Feature.json");

const patchSchemaPath = path.join(
  process.cwd(),
  "src/schema/FeaturePatch.json"
);

export class GeoValidationTransform extends Transform {
  ajv: Ajv;
  featureSchema: JSON;
  validate;

  constructor(
    options: TransformOptions = {},
    schema: Schema = "GeoValidation"
  ) {
    super({ ...options });

    this.ajv = new Ajv();
    this.featureSchema = this.loadFeatureSchema(schema);
    this.validate = this.ajv.compile(this.featureSchema);
  }

  /**
   * Loads the ajv-compatible schema for a GeoJSON Feature.
   * @param file Path to geojson feature schema
   * @returns JSON obj schema
   */
  private loadFeatureSchema(schema: Schema): JSON {
    let file;
    switch (schema) {
      case "GeoValidation":
        file = featureSchemaPath;
        break;
      case "PatchValidation":
        file = patchSchemaPath;
    }
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
