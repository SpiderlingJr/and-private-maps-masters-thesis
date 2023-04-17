import { randomGeometries as rg } from "./RandomGeometries";
import { writeFileSync } from "fs";
import { FeatureCollection, featureCollection as fc } from "@turf/turf";
import { prepUpdate } from "./PrepUpdateSet";
import path from "path";

const { postFeaturesToService, getFeatureIdsFromService } = prepUpdate;

const NUM_FEATURES = 3;
const STORE_PATH = "outgeos";

// write file as ndjson
function writeAsNdjson(features: FeatureCollection, path) {
  let ndjson = "";
  for (const feature of features.features) {
    ndjson += JSON.stringify(feature) + "\n";
  }
  ndjson = ndjson.slice(0, -1);

  writeFileSync(path, ndjson);
}
function writeAsGeojson(features: FeatureCollection, path: string) {
  writeFileSync(path, JSON.stringify(features));
}

/** Intended for use in automated tests, generates random data and stores it in the given path.
 *  Generates a fixed amount of features, as well as a mutated version of those features.
 *  After generating the data, its original version is loaded into the database, to receive a collectionId.
 *  The mutated version is then loaded into the database, to receive a featureId.
 *
 *  The output consists of 4 files, with name conventions:
 *  <random_id>_[g | o | 1 | 2]_<number_of_features>f.[geojson | ndjson]
 *  - g: all features as geojson, intended for visual inspection
 *  - o: original features as ndjson, the original version of the data
 *  - 1: original features as ndjson, with collectionId, original data existing in database, intended for patching 2nd version
 *  - 2: mutated features as ndjson, with collectionId, mutated data existing in database, intended for patching 1st version
 * @param numFeatures
 * @param storePath
 * @param id
 *
 * TODO add mutationOptions
 */
export default async function generateRandomGeoFeatures(
  numFeatures: number,
  storageDir?: string,
  id?: string
) {
  const genId = id || Math.floor(Math.random() * 100000).toString();
  const storeDir = storageDir || STORE_PATH;

  const originalFeaturesPath = path.join(
    storeDir,
    `${genId}_o_${NUM_FEATURES}f.ndjson`
  );
  const allFeaturesGeojsonPath = path.join(
    storeDir,
    `${genId}_g_${NUM_FEATURES}f.geojson`
  );
  const patchable1Path = path.join(
    storeDir,
    `${genId}_1_${NUM_FEATURES}f.ndjson`
  );
  const patchable2Path = path.join(
    storeDir,
    `${genId}_2_${NUM_FEATURES}f.ndjson`
  );

  // generate numFeatures random features
  const randomFeatures = rg.generateRandomGeometry(numFeatures);
  // mutate them
  const mutatedFeatures = rg.mutateGeometry(randomFeatures, {
    uniformMutation: true,
  });
  // patch original and mutated features into collective geojson
  const concatFeatures = randomFeatures.features.concat(
    mutatedFeatures.features
  );

  // Store original data as geojson for easy visualisation
  writeAsGeojson(fc(concatFeatures), allFeaturesGeojsonPath);
  // Store original data as ndjson
  writeAsNdjson(randomFeatures, originalFeaturesPath);

  // post features to database
  const jobId = await postFeaturesToService(originalFeaturesPath);
  // wait for job to finish, 1sec
  await new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
    if (!jobId) {
      // 1 sec should be enough for the job to finish
      throw new Error("JobId not found, aborting");
    }
  });
  // get collectionId and featureId from database
  const { collectionId, featureIds } = await getFeatureIdsFromService(jobId[0]);

  // add collectionId to mutated properties
  const mutatedFeaturesWithId = {
    ...mutatedFeatures,
    features: mutatedFeatures.features.map((feat, i) => ({
      featId: featureIds[i],
      ...feat,
    })),
  };
  mutatedFeaturesWithId.features = mutatedFeaturesWithId.features.map(
    (feat) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      feat.properties!.collectionId = collectionId;
      return feat;
    }
  );
  // add collectionId to original properties
  const originalFeaturesWithId = {
    ...randomFeatures,
    features: randomFeatures.features.map((feat, i) => ({
      featId: featureIds[i],
      ...feat,
    })),
  };
  // add collectionId to original properties
  originalFeaturesWithId.features = originalFeaturesWithId.features.map(
    (feat) => {
      //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      feat.properties!.collectionId = collectionId;

      return feat;
    }
  );

  writeAsNdjson(mutatedFeaturesWithId, patchable1Path);
  // Store original data as ndjson, with featId and collectionId
  writeAsNdjson(originalFeaturesWithId, patchable2Path);

  return {
    collectionId,
    geoJsonFilePath: allFeaturesGeojsonPath,
    originalFeaturesPath,
    patchable1Path,
    patchable2Path,
  };
}
