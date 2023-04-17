import * as turf from "@turf/turf";
import { FeatureCollection, BBox } from "@turf/turf";
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
type GeometryTypes = "Polygon" | "Point" | "LineString";
type GenerateOptions = {
  geomType: GeometryTypes;
};
type MutationOptions = {
  uniformMutation: boolean; // if true, the same mutation is applied to all features, else it's randomly determined for each feature
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
  mutateGeometry(
    feature: FeatureCollection,
    options?: Partial<MutationOptions>
  ): FeatureCollection;
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
      geometryOptions.bbox = [-170, -80, 170, 80];
    }
    if (generateOptions && generateOptions.geomType) {
      // Generate all of same geom type
      const geomType = generateOptions.geomType;
      switch (geomType) {
        case "Polygon":
          return turf.randomPolygon(count, geometryOptions as PolygonOptions);
        case "Point":
          return turf.randomPoint(count, geometryOptions as PointOptions);
        case "LineString":
          return turf.randomLineString(
            count,
            geometryOptions as LineStringOptions
          );
        default:
          throw new Error("Invalid type");
      }
    } else {
      // Generate different geom types
      const types = ["Polygon", "Point", "LineString"];
      let geomType: GeometryTypes;

      const features: FeatureCollection["features"] = [];
      for (let i = 0; i < count; i++) {
        geomType = types[
          Math.floor(Math.random() * types.length)
        ] as GeometryTypes;

        switch (geomType) {
          case "Polygon":
            features.push(
              turf.randomPolygon(1, geometryOptions as PolygonOptions)
                .features[0]
            );
            break;
          case "Point":
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

          default:
            throw new Error("Invalid type");
        }
      }
      return turf.featureCollection(features);
    }
  },
  mutateGeometry(
    feature: FeatureCollection,
    {
      uniformMutation = false, // if true, the same mutation is applied to all features, else it's randomly determined for each feature
      rotateScope = [-180, 180],
      translationDistanceScope = [0, 1],
      translationDirectionScope = [-180, 180],
      scaleScope = [0.5, 2],
      pRotate = 0.5,
      pTranslate = 0.5,
      pScale = 0.5,
    }: MutationOptions
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
    let rotationAngle = rollRotationAngle();
    let translationDistance = rollTranslationDistance();
    let translationDirection = rollTranslationDirection();
    let scaleFactor = rollScaleFactor();
    const mutatedFeatures = feature.features.map((f) => {
      let mutatedFeature = f;

      if (!uniformMutation) {
        // Reroll the mutation parameters
        rotationAngle = rollRotationAngle();
        translationDistance = rollTranslationDistance();
        translationDirection = rollTranslationDirection();
        scaleFactor = rollScaleFactor();
      }
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
  },
};
