import { createReadStream } from "fs";

import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { GeoJsonToCsvTransform } from "src/util/transforms/GeoJsonToCsvTransform.js";
import { GeoValidationTransform } from "src/util/transforms/GeoValidationTransform.js";
import { ReadlineTransform } from "src/util/transforms/ReadLineTransform.js";
import { MultipartFile } from "@fastify/multipart";

/**
 *
 * @param fpath Path to temporarily stored ndjson file
 * @param jobId Id of job
 * @param colId Id of new collection
 * @returns
 */
export function loadAndValidateGeoFeature(
  fpath: string,
  outpath: string,
  colId: string
): Promise<boolean> {
  const readStream = createReadStream(fpath);
  const readLineTransform = new ReadlineTransform();
  const geoValidationTransform = new GeoValidationTransform();
  const jsonToCsvTransform = new GeoJsonToCsvTransform(colId);
  const writeStream = createWriteStream(outpath);

  const validationPipeline = pipeline(
    readStream,
    readLineTransform,
    geoValidationTransform,
    jsonToCsvTransform,
    writeStream,

    (err) => {
      if (err) {
        console.error("Error in validation Pipeline:\n", err);
      }
    }
  );

  return new Promise((res, rej) => {
    validationPipeline.once("error", (e) => {
      console.log("Validation Pipeline FAILED");
      rej(e);
    });
    validationPipeline.once("finish", () => {
      //console.log("Validation Pipeline finished");
      res(true);
    });
  });
}

/**
 * Validation pipeline handling new data posted to server
 * @param data
 * @param colId
 * @param outpath
 * @returns
 */
export function validatePostData(
  data: MultipartFile,
  colId: string,
  outpath: string
): Promise<boolean> {
  const readLineTransform = new ReadlineTransform();
  const geoValidationTransform = new GeoValidationTransform();
  const jsonToCsvTransform = new GeoJsonToCsvTransform(colId, {}, "POST");
  const writeStream = createWriteStream(outpath);

  const validationPipeline = pipeline(
    data.file,
    readLineTransform,
    geoValidationTransform,
    jsonToCsvTransform,
    writeStream,

    (err) => {
      if (err) {
        console.error("Error in validation Pipeline:\n", err);
      }
    }
  );

  return new Promise((res, rej) => {
    validationPipeline.once("error", (e) => {
      console.log("Validation Pipeline FAILED");
      rej(e);
    });
    validationPipeline.once("finish", () => {
      //console.log("Validation Pipeline finished");
      res(true);
    });
  });
}

/**
 * Pipeline for validating patch data.
 * Patch data contains the id of the feature to be patched and the new data.
 * @param data
 * @param colId
 * @param outpath
 * @returns
 */
export function validatePatchData(
  data: MultipartFile,
  colId: string,
  outpath: string
): Promise<boolean> {
  const readLineTransform = new ReadlineTransform();
  const geoValidationTransform = new GeoValidationTransform();
  const jsonToCsvTransform = new GeoJsonToCsvTransform(colId, {}, "UPDATE");
  const writeStream = createWriteStream(outpath);

  const validationPipeline = pipeline(
    data.file,
    readLineTransform,
    geoValidationTransform,
    jsonToCsvTransform,
    writeStream,

    (err) => {
      if (err) {
        console.error("Error in validation Pipeline:\n", err);
      }
    }
  );

  return new Promise((res, rej) => {
    validationPipeline.once("error", (e) => {
      console.log("Validation Pipeline FAILED");
      rej(e);
    });
    validationPipeline.once("finish", () => {
      //console.log("Validation Pipeline finished");
      res(true);
    });
  });
}
