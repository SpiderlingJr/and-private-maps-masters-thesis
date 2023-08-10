import * as turf from "@turf/turf";
import { FeatureCollection, BBox } from "@turf/turf";
import { random } from "lodash";
type PolygonOptions = {
  bbox?: BBox;
  num_vertices?: number;
  max_radial_length?: number;
};
type PointOptions = {
  bbox?: BBox;
};
type LineStringOptions = {
  bbox?: BBox;
  num_vertices?: number;
  max_length?: number;
  max_rotation?: number;
};
type GeometryOptions = PolygonOptions | PointOptions | LineStringOptions;
type GeometryTypes = "Polygon"; //| "Point" | "LineString";
type GenerateOptions = {
  geomType: GeometryTypes;
};
type MutationOptions = {
  //uniformMutation: boolean; // if true, the same mutation is applied to all features, else it's randomly determined for each feature
  pMutation: number;
  rotateScope: [number, number];
  translationDistanceScope: [number, number];
  translationDirectionScope: [number, number];
  scaleScope: [number, number];
  pRotate: number;
  pTranslate: number;
  pScale: number;
};

interface RandomGeometries {
  generateRandomGeometry(
    count: number,
    geometryOptions?: Partial<GeometryOptions>,
    generateOptions?: Partial<GenerateOptions>
  ): FeatureCollection;
  mutateFeatureCollection(
    feature: FeatureCollection,
    options?: Partial<MutationOptions>
  ): FeatureCollection;
}

function isValidPolygon(feature) {
  if (feature.geometry.type !== "Polygon") return false;

  const coordinates = feature.geometry.coordinates;

  // Check if polygon is closed
  const isClosed =
    JSON.stringify(coordinates[0][0]) ===
    JSON.stringify(coordinates[0][coordinates[0].length - 1]);
  //console.log("isClosed: ", isClosed);
  if (!isClosed) return false;

  /*
  // Check winding order
  // Exterior ring should be counter-clockwise, any holes should be clockwise
  if (!turf.booleanClockwise(coordinates[0])) return false;
  // exterior ring
  for (let i = 1; i < coordinates.length; i++) {
    // holes
    if (!turf.booleanClockwise(coordinates[i])) return false;
  }
  */
  // Check winding order
  // Exterior ring should be counter-clockwise, any holes should be clockwise
  if (turf.booleanClockwise(coordinates[0])) {
    //console.log("clockwise, reversing exterior ring");
    coordinates[0] = coordinates[0].reverse();
  }
  // exterior ring
  for (let i = 1; i < coordinates.length; i++) {
    // holes
    if (!turf.booleanClockwise(coordinates[i])) {
      // console.log("counter-clockwise, reversing hole");
      coordinates[i] = coordinates[i].reverse();
    }
  }
  return true;
}
// Checks if a feature is within WGS84 bounds
function isWithinBounds(feature) {
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(feature);
  return minLng >= -180 && maxLng <= 180 && minLat >= -90 && maxLat <= 90;
}
export const randomGeometries: RandomGeometries = {
  generateRandomGeometry(
    count: number,
    geometryOptions?: GeometryOptions,
    generateOptions?: GenerateOptions
  ) {
    if (!geometryOptions) {
      // This shrinks the default bbox to prevent turf from generating geoms out of bounds
      // that would cause errors when mutating them
      geometryOptions = {};
      geometryOptions.bbox = [-150, -60, 150, 60];
    }
    //if (generateOptions && generateOptions.geomType) {
    // Generate all of same geom type
    //const geomType = generateOptions.geomType;
    const geomType = "Polygon";
    switch (geomType) {
      case "Polygon": {
        let validPolygons: turf.helpers.Feature<turf.helpers.Polygon>[] = [];
        while (validPolygons.length < count) {
          console.log(
            `Generating Polygons, current count: ${validPolygons.length}`
          );
          const randomPolygons = turf.randomPolygon(
            count - validPolygons.length,
            geometryOptions
          );
          //console.log("randomPolygons: ", JSON.stringify(randomPolygons));
          const newValidPolygons =
            randomPolygons.features.filter(isValidPolygon);
          validPolygons = [...validPolygons, ...newValidPolygons];
        }
        console.log("DONE GENERATING POLYS");
        return turf.featureCollection(validPolygons);
      }
      /*case "Point":
          return turf.randomPoint(count, geometryOptions as PointOptions);
        case "LineString":
          return turf.randomLineString(
            count,
            geometryOptions as LineStringOptions
          );*/
      default:
        throw new Error("Invalid type");
    }
    /*} else {
      // Generate different geom types
      const types = ["Polygon", "Point", "LineString"];
      let geomType: GeometryTypes;

      const features: FeatureCollection["features"] = [];
      for (let i = 0; i < count; i++) {
        geomType = "Polygon"; 
    */
    /*types[
          Math.floor(Math.random() * types.length)
        ] as GeometryTypes;*/

    /*    switch (geomType) {
          case "Polygon":
            features.push(
              turf.randomPolygon(1, geometryOptions as PolygonOptions)
                .features[0]
            );
            break;
    */
    /*case "Point":
            features.push(
              turf.randomPoint(1, geometryOptions as PointOptions).features[0]
            );
            break;
          case "LineString":
            features.push(
              turf.randomLineString(1, geometryOptions as LineStringOptions)
                .features[0]
            );
            break;
              */
    /*  default:
            throw new Error("Invalid type");
        }
      }
      return turf.featureCollection(features);
    }*/
  },
  mutateFeatureCollection(
    ft_collection: FeatureCollection,
    {
      pMutation = 0.6,
      rotateScope = [-180, 180],
      translationDistanceScope = [0, 5],
      translationDirectionScope = [-180, 180],
      scaleScope = [0.5, 1.5],
    }: //pRotate = 0.5,
    //pTranslate = 0.5,
    //pScale = 0.5,
    MutationOptions
  ): FeatureCollection {
    const rollRotationAngle = () => {
      return Math.random() * (rotateScope[1] - rotateScope[0]) + rotateScope[0];
    };
    const rollTranslationDistance = () => {
      return (
        Math.random() *
          (translationDistanceScope[1] - translationDistanceScope[0]) +
        translationDistanceScope[0]
      );
    };
    const rollTranslationDirection = () => {
      return (
        Math.random() *
          (translationDirectionScope[1] - translationDirectionScope[0]) +
        translationDirectionScope[0]
      );
    };
    const rollScaleFactor = () => {
      return Math.random() * (scaleScope[1] - scaleScope[0]) + scaleScope[0];
    };
    console.log("mutating features", pMutation);
    const p = pMutation;
    const mutatedFeatures = ft_collection.features.map((feature) => {
      let isValid = false;
      let mutatedGeometry;
      while (!isValid) {
        // Apply transformations only with certain chance
        if (Math.random() < p) {
          const rotationAngle = rollRotationAngle();
          const translationDistance = rollTranslationDistance();
          const translationDirection = rollTranslationDirection();
          const scaleFactor = rollScaleFactor();

          mutatedGeometry = turf.transformScale(feature, scaleFactor);
          mutatedGeometry = turf.transformRotate(
            mutatedGeometry,
            rotationAngle
          );
          mutatedGeometry = turf.transformTranslate(
            mutatedGeometry,
            translationDistance,
            translationDirection
          );
        } else {
          // If no transformations are applied, the geometry remains the same
          mutatedGeometry = feature;
        }
        // Check if the mutated geometry is valid and within WGS84 bounds
        isValid =
          isValidPolygon(mutatedGeometry) && isWithinBounds(mutatedGeometry);
        if (!isValid) {
          console.log("invalid geometry during mutation, retrying");
        }
      }
      return mutatedGeometry;
    });
    return turf.featureCollection(mutatedFeatures);
  },
  /*
  return turf.featureCollection(mutatedFeatures);
        // Reroll the mutation parameters
        rotationAngle = rollRotationAngle();
        translationDistance = rollTranslationDistance();
        translationDirection = rollTranslationDirection();
        scaleFactor = rollScaleFactor();
      
      try {
        if (Math.random() < pRotate && f.geometry.type !== "Point") {
          mutatedFeature = turf.transformRotate(mutatedFeature, rotationAngle);
          mutatedFeature.properties = {
            ...mutatedFeature.properties,
            rotationAngle,
          };
        }
      } catch (e) {
        // Should not happen anymore due to reduced bbox. But just in case,
        // as this will cause problems when receiving the feature Ids
        if (mutatedFeature.geometry.type === "Polygon") {
          //console.log(mutatedFeature.geometry.coordinates);
        }
        mutatedFeature.properties = {
          ...mutatedFeature.properties,
          "error:": "rotate",
        };
        console.error("error", e);
      }
      if (Math.random() < pTranslate) {
        mutatedFeature = turf.transformTranslate(
          mutatedFeature,
          translationDistance,
          translationDirection
        );
        mutatedFeature.properties = {
          ...mutatedFeature.properties,
          translationDistance,
          translationRotation: translationDirection,
        };
      }
      if (Math.random() < pScale && f.geometry.type !== "Point") {
        mutatedFeature = turf.transformScale(mutatedFeature, scaleFactor);
        mutatedFeature.properties = {
          ...mutatedFeature.properties,
          scaleFactor,
        };
      }
      return mutatedFeature;
    });
    return turf.featureCollection(mutatedFeatures);
    */
};
