import { createReadStream, unlink } from "fs";

import { createWriteStream } from "fs";
import { PostGisConnection } from "./PostGisConnection.js";
import { makeId } from "./makeid.js";
import { GeoJsonToCsvTransform } from "./GeoJsonToCsvTransform.js";
import { GeoValidationTransform } from "./GeoValidationTransform.js";

import { pipeline } from "stream";
import { ReadlineTransform } from "./ReadLineTransform.js";

export class GeodataUpstreamHandler {
  postgis;

  constructor(pgConn: PostGisConnection) {
    // Database connection
    this.postgis = pgConn;
  }

  /**
   * Reads a file from path, validates it's geojson content and streams it to database
   * @param fpath path to json-file
   * @param jobId uuid of currently handled upload job
   * @param deleteTmpFile default true. If true, deletes passed file after processing
   */
  async validateAndUploadGeoFeature(
    fpath: string,
    jobId: string,
    deleteTmpFile = true
  ) {
    const tmpCsvStorage = "storage/validated/" + makeId() + ".csv";

    // Create new collection for feature batch
    const colId = await this.postgis.createNewCollection();

    const readStream = createReadStream(fpath);
    const readLineTransform = new ReadlineTransform();
    const geoValidationTransform = new GeoValidationTransform();
    const jsonToCsvTransform = new GeoJsonToCsvTransform(colId);
    const writeStream = createWriteStream(tmpCsvStorage);

    // Start validating uploaded geofeatures
    const validationPipeline = pipeline(
      readStream,
      readLineTransform,
      geoValidationTransform,
      jsonToCsvTransform,
      writeStream,
      (err) => {
        if (err) {
          console.error("Pipeline error", err);
          //validationPipeline.emit("error");
        }
      }
    );

    const validationComplete = new Promise((res, rej) => {
      validationPipeline.once("finish", () => {
        //console.log("Validation Pipeline finished");
        res("ok");
      });
      validationPipeline.once("error", () => {
        //console.log("Validation Pipeline FAILED");
        rej();
      });
    });

    validationComplete
      // Upon finishing validation, upload file if valid, else declare job failed.
      .then(() => {
        //console.log("Now trying to upload.");
        this.postgis.uploadDataFromCsv(tmpCsvStorage);
        this.postgis.updateJob(jobId, "finished");
      })
      // Any errors mark the job as failed, no upload happens.
      .catch((err) => {
        console.log("Error doring upload? ", err);
        this.postgis.updateJob(jobId, "error");
      })
      // Cleanup temporarily stored files
      .finally(() => {
        if (deleteTmpFile) {
          unlink(fpath, function (err) {
            if (err) {
              console.error(
                "Error while trying to delete file: ",
                err,
                err.stack
              );
            }
          });
        }
      });
  }
}
