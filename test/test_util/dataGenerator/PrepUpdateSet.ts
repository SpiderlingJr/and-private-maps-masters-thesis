// Script that loads in an ndjson file and receives their feature ids from db
import { createReadStream } from "fs";
import FormData from "form-data";
import { app } from "../../../src/app.js";
import { LightMyRequestResponse } from "fastify";

interface PrepUpdate {
  /** Injects a post request to the service, containing the features in
   * the given file.
   *
   * @param fpath
   */
  postFeaturesToService(fpath: string): Promise<LightMyRequestResponse>;
  getFeatureIdsFromService(collectionId: string): Promise<string[]>;
}

export const prepUpdate: PrepUpdate = {
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
};
