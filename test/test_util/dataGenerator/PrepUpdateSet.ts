// Script that loads in an ndjson file and receives their feature ids from db
import { createReadStream } from "fs";
import FormData from "form-data";
import { request } from "http";

interface PrepUpdate {
  postFeaturesToService(fpath: string): Promise<string[]>;
  getFeatureIdsFromService(
    collectionId: string
  ): Promise<{ collectionId: string; featureIds: string[] }>;
}

export const prepUpdate: PrepUpdate = {
  async postFeaturesToService(fpath: string): Promise<string[]> {
    /**
     * Post features to service and return collection id
     */
    const form = new FormData();
    form.append("randomFeatures", createReadStream(fpath));

    //console.log("datapath", fpath);
    const p = new Promise<string[]>((resolve, reject) => {
      const req = request(
        {
          host: "localhost",
          port: "3000",
          path: "/data",
          method: "POST",
          headers: form.getHeaders(),
        },
        (res) => {
          const response: string[] = [];
          res.on("data", (data) => {
            // this is always the collection id
            response.push(data.toString());
          });
          res.on("end", () => {
            resolve(response);
          });
          res.on("error", (err) => {
            console.log("error", err);
            reject(err);
          });
        }
      );
      form.pipe(req);
    });
    return p;
    /*
    const res = await app.inject({
      method: "POST",
      url: "/data",
      headers: form.getHeaders(),
      payload: form,
    });

    console.log("res", res);

    return [res.body];*/
  },

  async getFeatureIdsFromService(jobId: string) {
    const jobUrl = `http://localhost:3000/job/${jobId}`;
    const jobResponse = await fetch(jobUrl);

    const jobResponseJson = await jobResponse.json();

    if (jobResponseJson.job_state !== "finished") {
      throw new Error("Job not finished");
    }
    const collectionId: string = jobResponseJson.job_collection;

    const collUrl = `http://localhost:3000/collections/${collectionId}/items`;
    const res = await fetch(collUrl);
    const feats = await res.json();
    const featIds: string[] = feats.map((feat) => feat.Features_feature_id);

    const response = {
      collectionId,
      featureIds: featIds,
    };
    return response;
  },
};
