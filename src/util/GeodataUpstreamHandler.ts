import { createReadStream, unlink } from "fs";

import { createWriteStream } from "fs";
import { PostGisConnection } from "./PostGisConnection.js";
import { makeId } from "./MakeId.js";
import { pipeline } from "stream";
import { GeoJsonToCsvTransform } from "../plugins/validation/transforms/GeoJsonToCsvTransform.js";
import { GeoValidationTransform } from "../plugins/validation/transforms/GeoValidationTransform.js";
import { ReadlineTransform } from "../plugins/validation/transforms/ReadLineTransform.js";
import { JobState } from "../entities/jobs.js";
import { PatchJsonToCsvTransform } from "../plugins/validation/transforms/PatchJsonToCsvTransform.js";

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
   *
   * @param tmpStorage
   * @param jobId
   */
  async validateAndPatchGeoFeature(fpath: string, jobId: string) {
    const tmpValidatedCsv = "storage/validated/" + makeId() + ".csv";

    // Create new collection for feature batch
    const colId = await this.postgis.createNewCollection();

    const readStream = createReadStream(fpath);
    const readLineTransform = new ReadlineTransform();
    const geoValidationTransform = new GeoValidationTransform(
      {},
      "PatchValidation"
    );
    const patchToCsvTransform = new PatchJsonToCsvTransform();
    const writeStream = createWriteStream(tmpValidatedCsv);

    // Start validating uploaded geofeatures
    const validationPipeline = pipeline(
      readStream,
      readLineTransform,
      geoValidationTransform,
      patchToCsvTransform,
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
        this.postgis
          .pgPatch(tmpValidatedCsv)
          .then(() => {
            this.postgis.updateJob(jobId, JobState.FINISHED, colId);
            this.removeFile(tmpValidatedCsv);
          })
          .catch((err) => {
            this.postgis.updateJob(
              jobId,
              JobState.ERROR,
              "Could not copy stream to db after validation"
            );
            throw new Error(err);
          });
      })
      // Any errors mark the job as failed, no upload happens.
      .catch((err) => {
        this.postgis.updateJob(jobId, JobState.ERROR, colId, err);
        throw new Error(err);
        //console.error("Error during upload? ", err);
      })
      // Cleanup temporarily stored files
      .finally(() => {
        this.removeFile(fpath);
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
    const tmpValidatedCsv = `storage/validated/${makeId()}.csv`;

    // Create new collection for feature batch
    const colId = await this.postgis.createNewCollection();

    const readStream = createReadStream(fpath);
    const readLineTransform = new ReadlineTransform();
    const geoValidationTransform = new GeoValidationTransform();
    const jsonToCsvTransform = new GeoJsonToCsvTransform(colId);
    const writeStream = createWriteStream(tmpValidatedCsv);

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
      validationPipeline.once("error", (e) => {
        console.log("Validation Pipeline FAILED");
        rej(e);
      });
      validationPipeline.once("finish", () => {
        //console.log("Validation Pipeline finished");
        res("ok");
      });
    });

    await validationComplete
      // Upon finishing validation, upload file if valid, else declare job failed.
      .then(() => {
        this.postgis
          .pgCopyInsert(tmpValidatedCsv)
          .then(() => {
            this.postgis.updateJob(jobId, JobState.FINISHED, colId);
            this.removeFile(tmpValidatedCsv);
          })
          .catch((err) => {
            this.postgis.updateJob(
              jobId,
              JobState.ERROR,
              colId,
              "Could not copy stream to db after validation"
            );
            throw new Error(err);
          });
      })
      // Any errors mark the job as failed, no upload happens.
      .catch((err) => {
        this.postgis.updateJob(jobId, JobState.ERROR, colId);
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
