import { createReadStream, fstat } from "fs";
import { createInterface } from "readline";
import * as Ajv from "ajv";
import { readFileSync } from "fs";
import * as path from "path";

const featureSchemaPath = path.join(process.cwd(), "src/schema/Feature.json");

export class GeoJSONFeatureValidator {
  ajv: Ajv.default;
  featureSchema: JSON;
  validate;

  constructor() {
    this.ajv = new Ajv.default();
    this.featureSchema = this.loadFeatureSchema();
    this.validate = this.ajv.compile(this.featureSchema);
  }

  private loadFeatureSchema(file: string = featureSchemaPath): JSON {
    const fileData = readFileSync(file, "utf-8");
    return JSON.parse(fileData);
  }

  /**
   * Runs a string against a schema, checking if it is a valid geojson feature.
   * @param line String to run against geojson schema
   * @returns true if valid geojson, false otherwise
   */
  private isValidGeoJsonFeature(line: string): boolean {
    try {
      const json_obj = JSON.parse(line);
      const valid = this.validate(json_obj);
      console.log(`Valid? ${valid}`);
      if (!valid) console.log(this.validate.errors);

      return valid;
    } catch (e) {
      console.log("Couldnt parse JSON File");
      return false;
    }
  }

  /**
   * Reads a file from path, validates it's geojson content and uploads it to database
   * @param fpath path to json-file
   */
  validateAndUploadGeoFeature(fpath: string) {
    const file = createInterface({
      input: createReadStream(fpath),
      //output: process.stdout,
      terminal: false,
    });

    file
      .on("line", (line) => {
        if (this.isValidGeoJsonFeature(line)) {
          console.log("Valid");

          // Todo Pump -> DB
        } else {
          console.log("Invalid.");
          // Stop reading if file contains erroneous features?
          //file.close();
          //file.removeAllListeners();
        }
      })
      .on("close", function () {
        console.log("DONE");
      });
  }
}
