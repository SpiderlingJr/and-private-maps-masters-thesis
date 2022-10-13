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

  private async removeFile(file: string) {
    unlink(file, function (err) {
      if (err) {
        console.error("Error while trying to delete file: ", err, err.stack);
      }
    });
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
        }
      }
    );

    const validationComplete = new Promise((res, rej) => {
      validationPipeline.once("error", () => {
        //console.log("Validation Pipeline FAILED");
        rej("rip");
      });
      validationPipeline.once("finish", () => {
        //console.log("Validation Pipeline finished");
        res("ok");
      });
    });

    await validationComplete
      // Upon finishing validation, upload file if valid, else declare job failed.
      .then(() => {
        this.postgis.uploadDataFromCsv(tmpCsvStorage).then(() => {
          this.postgis.updateJob(jobId, "finished");
          this.removeFile(tmpCsvStorage);
        });
      })
      // Any errors mark the job as failed, no upload happens.
      .catch((err) => {
        this.postgis.updateJob(jobId, "error");
        throw new Error(err);
        //console.error("Error during upload? ", err);
      })
      // Cleanup temporarily stored files
      .finally(() => {
        if (deleteTmpFile) {
          this.removeFile(fpath);
        }
      });
  }
}
