import { createReadStream, unlink } from "fs";

import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { GeoJsonToCsvTransform } from "src/util/transforms/GeoJsonToCsvTransform.js";
import { GeoValidationTransform } from "src/util/transforms/GeoValidationTransform.js";
import { ReadlineTransform } from "src/util/transforms/ReadLineTransform.js";
import { PatchJsonToCsvTransform } from "src/util/transforms/PatchJsonToCsvTransform.js";

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
