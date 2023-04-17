import * as turf from "@turf/turf";

type PolygonOptions = {
  bbox?: turf.helpers.BBox;
  num_vertices?: number;
  max_radial_length?: number;
};

type PointOptions = {
  bbox?: turf.helpers.BBox;
};

type LineStringOptions = {
  bbox?: turf.helpers.BBox;
  num_vertices?: number;
  max_radial_length?: number;
};

type GeomOptions = LineStringOptions | PointOptions | PolygonOptions;

const MutationOptions = {
  rotateScope: [-180, 180],
  translateScope: [
    [-180, -90],
    [180, 90],
  ],
  scaleScope: [0.5, 2],
  pRotate: 0.5,
  pTranslate: 0.5,
  pScale: 0.5,
};

interface RandomGeometries {
  generateRandomGeometry(count: 1, type: "Polygon"): turf.helpers.AllGeoJSON;
  alterGeometry<T extends turf.helpers.AllGeoJSON>(
    feature: T,
    options?: typeof MutationOptions
  ): T;
}

export const randomGeometries: RandomGeometries = {
  generateRandomGeometry(count: 1, type: string, options?: GeomOptions) {
    switch (type) {
      case "Polygon":
        return turf.randomPolygon(count, options as PolygonOptions);
      case "Point":
        return turf.randomPoint(count, options as PointOptions);
      case "LineString":
        return turf.randomLineString(count, options as LineStringOptions);
      default:
        throw new Error("Invalid type");
    }
  },
  alterGeometry<T extends turf.helpers.AllGeoJSON>(
    feature: T,
    options = MutationOptions
  ): T {
    console.log("in Alter");
    let mutatedFeature = feature;
    console.log("mutatedFeatureOptions", options);

    /*if (Math.random() < options.pRotate) {
      mutatedFeature = turf.transformRotate(
        mutatedFeature,
        Math.random() * (options.rotateScope[1] - options.rotateScope[0]) +
          options.rotateScope[0]
      );
    }*/

    if (Math.random() < options.pTranslate) {
      mutatedFeature = turf.transformTranslate(
        mutatedFeature,
        Math.random() *
          (options.translateScope[1][0] - options.translateScope[0][0]) +
          options.translateScope[0][0],
        Math.random() *
          (options.translateScope[1][1] - options.translateScope[0][1]) +
          options.translateScope[0][1]
      );
    }

    if (Math.random() < options.pScale) {
      mutatedFeature = turf.transformScale(
        mutatedFeature,
        Math.random() * (options.scaleScope[1] - options.scaleScope[0]) +
          options.scaleScope[0]
      );
    }
    return mutatedFeature;
  },
};
