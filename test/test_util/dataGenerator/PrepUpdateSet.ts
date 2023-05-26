// Script that loads in an ndjson file and receives their feature ids from db
import { createReadStream, writeFileSync } from "fs";
import FormData from "form-data";
import { app } from "../../../src/app.js";
import { LightMyRequestResponse } from "fastify";
import { FeatureCollection } from "@turf/turf";
import { ReadlineTransform } from "../../../src/plugins/validation/transforms/ReadLineTransform.js";
import { pipeline } from "stream";
import * as turf from "@turf/turf";
import { Transform, TransformCallback } from "stream";

interface PrepUpdate {
  /** Loads a given ndjson file and returns it as turf feature collection.
   *
   * Reads the file line by line and parses each line as json, then pushes it
   * as feature to the feature collection.
   *
   * @param fpath
   */
  loadNdjsonAsFeatureCollection(fpath: string): Promise<FeatureCollection>;
  /** Injects a post request to the service, containing the features in
   * the given file.
   *
   * @param fpath
   */
  postFeaturesToService(fpath: string): Promise<LightMyRequestResponse>;
  getFeatureIdsFromService(collectionId: string): Promise<string[]>;
  /** Takes a feature collection and assigns the given property to each feature
   * in the collection.
   *
   * @param ndjson object to assign property to
   * @param pName name of property to add
   * @param pValues values to assign to property
   */
  assignPropertyToFeatureCollection<T>(
    ndjson: FeatureCollection,
    pName: string,
    pValues: Array<T>
  ): FeatureCollection;
  /** Injects a patch collection request to the service, containing the features
   * in the given file as multipart form data.
   *
   * @param collectionId id of collection to patch
   * @param fpath path to ndjson file. The update features must contain the
   * property "featId" with the feature id of the feature to update. Given
   * feature ID must already exist in the database.
   */
  patchFeatures(
    collectionId: string,
    fpath: string,
    description?: string
  ): Promise<LightMyRequestResponse>;
  /** Writes the given feature collection to the given path as ndjson.
   *
   * @param features
   * @param path
   */
  writeAsNdjson(features: FeatureCollection, path: string): void;
  /** Writes the given feature collection to the given path as geojson.
   *
   * @param features
   * @param path
   */
  writeAsGeojson(features: FeatureCollection, path: string): void;
}

export class PushToFeatureCollectionTransform extends Transform {
  featureCollection: FeatureCollection;
  constructor(featureCollection: FeatureCollection, options = {}) {
    super({ ...options });
    this.featureCollection = featureCollection;
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = chunk.toString();
    const featureAsGeom = JSON.parse(line) as turf.Feature;

    const parsedLine = this.pushToFeatureCollection(featureAsGeom);
    this.push(parsedLine);
    callback();
  }
  _flush(callback: TransformCallback): void {
    callback();
  }

  /**
   * Converts a valid ndjson geofeature to a csv-line that is compatible with pg-copy-streams
   * @param ndj GeoJSON Feature
   * @returns csv line, newline terminated.
   */
  private pushToFeatureCollection(line: turf.Feature): void {
    // line to feature
    const feature = turf.feature(line);
    this.featureCollection.features.push(feature.geometry);
  }
}

const prepUpdate: PrepUpdate = {
  async loadNdjsonAsFeatureCollection(fpath: string) {
    const features = turf.featureCollection([]);

    const loadPipeline = pipeline(
      createReadStream(fpath),
      new ReadlineTransform(),
      new PushToFeatureCollectionTransform(features),
      (err) => {
        if (err) {
          console.error("Error in load Pipeline:\n", err);
        }
      }
    );

    // run pipeline, then return features
    await new Promise((res, rej) => {
      loadPipeline.once("error", (e) => {
        console.log("Load Pipeline FAILED");
        rej(e);
      });
      loadPipeline.once("finish", () => {
        res(true);
      });
    });
    return features;
  },
  async postFeaturesToService(fpath: string, description?: string) {
    const form = new FormData();
    form.append(description ?? "randomData", createReadStream(fpath));
    const response = await app.inject({
      method: "POST",
      url: "/data",
      payload: form,
      headers: form.getHeaders(),
    });
    return response;
  },
  async getFeatureIdsFromService(collectionId: string) {
    const featureResponse = await app.inject({
      method: "GET",
      url: `/collections/${collectionId}/items`,
    });
    const feats = await featureResponse.json();
    const featIds: string[] = feats.map((feat) => feat.Features_feature_id);

    return featIds;
  },
  assignPropertyToFeatureCollection<U extends string | number, T>(
    ndjson: FeatureCollection,
    pName: U,
    pValues: Array<T>
  ) {
    if (!ndjson) {
      return null as unknown as FeatureCollection;
    }
    const obj = JSON.parse(JSON.stringify(ndjson)) as FeatureCollection;

    console.log("obj", obj);
    const featuresWithNewProp = {
      ...obj,
      features: obj.features.map((feat, i) => ({
        [pName]: pValues[i],
        ...feat,
      })),
    };
    return featuresWithNewProp;
  },
  async patchFeatures(
    collectionId: string,
    fpath: string,
    description?: string
  ) {
    const patchForm = new FormData();
    patchForm.append(description ?? "randomPatchData", createReadStream(fpath));
    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/collections/${collectionId}`,
      payload: patchForm,
      headers: patchForm.getHeaders(),
    });
    return patchResponse;
  },
  writeAsNdjson(features: FeatureCollection, path: string) {
    let ndjson = "";
    for (const feature of features.features) {
      ndjson += JSON.stringify(feature) + "\n";
    }
    ndjson = ndjson.slice(0, -1);

    writeFileSync(path, ndjson);
  },
  writeAsGeojson(features: FeatureCollection, path: string) {
    writeFileSync(path, JSON.stringify(features));
  },
};
export default prepUpdate;
