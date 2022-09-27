import { createReadStream, unlink } from "fs";
import { createInterface } from "readline";
import * as Ajv from "ajv";
import { readFileSync } from "fs";
import * as path from "path";
import Pool from "pg-pool";
import { createWriteStream } from "fs";
import pgcopy from "pg-copy-streams";

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
  postgres;

  constructor() {
    this.ajv = new Ajv.default();
    this.featureSchema = this.loadFeatureSchema();
    this.validate = this.ajv.compile(this.featureSchema);

    // Database connection
    // TODO outsource auth to env
    this.postgres = new Pool({
      //host: "127.0.0.1",
      database: "idp",
      user: "idp",
      password: "idpdev",
      port: 8081,
    });
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
    const tmpCsvStorage = "storage/received/" + this.makeId() + ".csv";
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
          //file.close();
          //file.removeAllListeners();
        }
      })
      .on("close", function () {
        console.log("DONE");
        file.close();
        file.removeAllListeners();
      });

    setImmediate(() => {
      this.uploadGeoCSV(tmpCsvStorage);
    });

    if (del_file) {
      unlink(fpath, function (err) {
        if (err) {
          console.error(err);
        }
      });
    }
  }

  /**
   * Generates a random string of default 16 characters.
   * @param length amount of characters to be generated
   * @returns
   */
  private makeId(length = 16): string {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  /**
   * Streams csv file to postgres database. Deletes file after processing
   * @param file
   */
  private uploadGeoCSV(file: string) {
    this.postgres.connect(function (err, client, done) {
      if (err) {
        console.log(err);
      } else if (client === undefined || done === undefined) {
        // TODO how would this happen?
        console.log("Client or Done is undefined!");
      } else {
        const stream = client.query(
          pgcopy.from(
            "COPY some_coordinates(geom, properties) FROM STDIN (FORMAT CSV, DELIMITER ';')"
          )
        );
        const fileStream = createReadStream(file);

        fileStream.on("error", done);
        stream.on("error", done);
        stream.on("finish", () => {
          unlink(file, function (err) {
            if (err) {
              console.error(err);
            }
          });
        });
        fileStream.pipe(stream);
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
