import { randomGeometries as rg } from "./RandomGeometries";
import { writeFileSync } from "fs";
import { FeatureCollection, featureCollection as fc } from "@turf/turf";
import prepUpdate from "./PrepUpdateSet";
import path from "path";
import { awaitJobCompletion } from "../injects";

const {
  postFeaturesToService: postFeaturesToService,
  getFeatureIdsFromService,
} = prepUpdate;

const NUM_FEATURES = 3;
const STORE_PATH = "outgeos";

// write file as ndjson
function writeAsNdjson(features: FeatureCollection, path: string) {
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
    `${genId}_o_${numFeatures}f.ndjson`
  );
  const allFeaturesGeojsonPath = path.join(
    storeDir,
    `${genId}_g_${numFeatures}f.geojson`
  );
  const patchableMutatedPath = path.join(
    storeDir,
    `${genId}_1_${numFeatures}f.ndjson`
  );
  const patchableOriginalPath = path.join(
    storeDir,
    `${genId}_2_${numFeatures}f.ndjson`
  );

  // generate numFeatures random features
  const randomFeatures = rg.generateRandomGeometry(numFeatures, {
    bbox: [6.5, 47.2, 14.5, 54.9], //germany
    //bbox: [-180, -90, 180, 90],
    max_radial_length: 0.5,
  });
  // mutate them
  const mutatedFeatures = rg.mutateFeatureCollection(randomFeatures, {
    pMutation: 0.75,
  });
  // patch original and mutated features into collective geojson
  const concatFeatures = randomFeatures.features.concat(
    mutatedFeatures.features
  );

  // Store original data as geojson for easy visualisation
  writeAsGeojson(fc(concatFeatures), allFeaturesGeojsonPath);
  // Store original data as ndjson
  writeAsNdjson(randomFeatures, originalFeaturesPath);

  /*
  // post features to database
  const postResponse = await postFeaturesToService(originalFeaturesPath);
  // wait for job to finish, 1sec
  const jobId = postResponse.body;
  const jobResponse = await awaitJobCompletion(jobId);
  const collectionId = JSON.parse(jobResponse.body).job_collection;
  // get collectionId and featureId from database
  const featureIds = await getFeatureIdsFromService(collectionId);
  
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
  */
  writeAsNdjson(mutatedFeatures, patchableMutatedPath);
  // Store original data as ndjson, with featId and collectionId
  //writeAsNdjson(originalFeaturesWithId, patchableOriginalPath);

  return {
    //collectionId,
    geoJsonFilePath: allFeaturesGeojsonPath,
    originalFeaturesPath,
    patchableMutatedPath,
    patchableOriginalPath,
  };
}
