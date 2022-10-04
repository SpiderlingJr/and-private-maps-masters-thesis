import { createReadStream, unlink } from "fs";
import { createInterface } from "readline";
import * as Ajv from "ajv";
import { readFileSync } from "fs";
import * as path from "path";
import { createWriteStream } from "fs";
import { PostGisConnection } from "./PostGisConnection.js";
import { makeId } from "./makeid.js";
// GeoJSON Feature Schema, for validation of received data
const featureSchemaPath = path.join(process.cwd(), "src/schema/Feature.json");

interface GeoFeatureJSON {
  geometry: object;
  properties: object;
}

export class GeodataUpstreamHandler {
  ajv: Ajv.default;
  featureSchema: JSON;
  validate;
  postgis;

  constructor() {
    this.ajv = new Ajv.default();
    this.featureSchema = this.loadFeatureSchema();
    this.validate = this.ajv.compile(this.featureSchema);

    // Database connection
    // TODO outsource auth to env
    this.postgis = new PostGisConnection();
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

      //if (!valid) console.log(this.validate.errors);
      return valid;
    } catch (e) {
      console.log("Couldnt parse JSON File \n" + e);
      return false;
    }
  }

  /**
   * Reads a file from path, validates it's geojson content and streams it to database
   * @param fpath path to json-file
   * @param del_file default true. If true, deletes passed file after processing
   */
  validateAndUploadGeoFeature(fpath: string, del_file = true) {
    const file = createInterface({
      input: createReadStream(fpath),
      //output: process.stdout,
      terminal: false,
    });
    const tmpCsvStorage = "storage/validated/" + makeId() + ".csv";
    const writeStream = createWriteStream(tmpCsvStorage);
    file
      .on("line", (line) => {
        if (this.isValidGeoJsonFeature(line)) {
          // parse feature String to JSON, then format as valid CSV for pg-copystream import
          const parsedLine = this.ndJSONtoCSV(
            JSON.parse(line) as GeoFeatureJSON
          );
          writeStream.write(parsedLine);
        } else {
          console.log("Invalid line: " + line);
          // Stop reading if file contains erroneous features?
          // file.close();
          // file.removeAllListeners();
        }
      })
      .on("close", function () {
        console.log("DONE");
        file.close();
        file.removeAllListeners();
      });

    setImmediate(() => {
      this.postgis.uploadDataFromCsv(tmpCsvStorage);
      if (del_file) {
        unlink(fpath, function (err) {
          if (err) {
            console.error(err);
          }
        });
      }
    });
  }

  /**
   * Converts a valid ndjson geofeature to a csv-line that is compatible with pg-copy-streams
   * @param ndj GeoJSON Feature
   * @returns csv line, newline terminated.
   */
  private ndJSONtoCSV(ndj: GeoFeatureJSON) {
    // build column values for db input
    const col_properties = ndj.properties;
    const col_geom = ndj.geometry;

    const csv_properties = JSON.stringify(col_properties).replaceAll('"', '""');
    const csv_geom = JSON.stringify(col_geom).replaceAll('"', '""');

    const csv_line = '"' + csv_geom + '";"' + csv_properties + '"\n';
    console.log(csv_line);

    return csv_line;
  }
}
