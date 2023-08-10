import Map from "ol/Map";
import View from "ol/View";
import MVT from "ol/format/MVT";
import VectorTileLayer from "ol/layer/VectorTile";
import TileLayer from "ol/layer/WebGLTile";
import DataTile from "ol/source/DataTile";
import OSM from "ol/source/OSM";
import VectorTileSource from "ol/source/VectorTile";

import { Type } from "ol/geom/Geometry";
import { Draw, Interaction, Modify, Snap } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import { transform } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import { Circle, Fill, Stroke, Style } from "ol/style";

import * as turf from "@turf/turf";

import Feature from "ol/Feature";
import { LineString, MultiPoint, MultiPolygon, Polygon } from "ol/geom";

import {
  philippineSea1,
  philippineSea2,
  setzensack1,
  setzensack2,
  titanicSeaRoutePlanned,
  titanicSeaRouteActual,
  africaL,
  africaLWestCoastPatch,
  clusterStress,
  clusterStressPatchPolys,
  clusterStressPatchPoints,
} from "./prefabGeo";

const postgisCalcedDelta = turf.polygon([
  [
    [1366395.5515403417, 6197499.567978062],
    [1366395.504254352, 6197498.689782293],
    [1366324.6943056888, 6197517.886108183],
    [1366395.5515403417, 6197499.567978062],
  ],
  /*[
    [1366399.6288706062, 6197575.292528696],
    [1366389.2390888885, 6197684.586008556],
    [1366470.4081590632, 6197684.782590383],
    [1366694.152618517, 6197569.172007815],
    [1366790.4788778685, 6197535.100126101],
    [1366751.2524381902, 6197414.725945642],
    [1366739.296976532, 6197416.256047683],
    [1366703.3158513773, 6197412.759818201],
    [1366554.4765726707, 6197504.394970648],
    [1366538.1450679235, 6197439.625388365],
    [1366497.946022559, 6197473.096855916],
    [1366395.5515403417, 6197499.567978062],
    [1366399.6288706062, 6197575.292528696],
  ],
  */
]);

const drawLayer = new VectorSource();
const deltaLayer = new VectorSource();
const prefabLayer1 = new VectorSource();
const prefabLayer2 = new VectorSource();

/*
drawLayer.addFeature(
  new Feature({
    geometry: new Polygon(postgisCalcedDelta.geometry.coordinates),
  })
);

const intersect = turf.intersect(setzensack1, setzensack2);
const union = turf.union(setzensack1, setzensack2);

let delta;
if (union && intersect) {
  delta = turf.difference(union, intersect);
} else {
  console.log("union or intersect is null");
}

console.log("delta", delta);
if (delta) {
  deltaLayer.addFeature(
    new Feature({
      name: "Thing3",
      geometry:
        delta.geometry.type === "Polygon"
          ? new Polygon(delta.geometry.coordinates)
          : new MultiPolygon(delta.geometry.coordinates),
    })
  );
}
*/
const drawStyle = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(40, 128, 200, 1.0)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(40, 128, 200, 0.1)",
      }),
      image: new Circle({
        radius: 4,
        fill: new Fill({
          color: "rgba(40, 128, 200, 0.1)",
        }),
        stroke: new Stroke({
          color: "rgba(40, 128, 200, 1.0)",
          width: 2,
        }),
      }),
    }),
  ];
};

const styleBlue = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(0, 0, 255, 1.0)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(0, 0, 255, 0.1)",
      }),
      image: new Circle({
        radius: 4,
        fill: new Fill({
          color: "rgba(0, 0, 255, 0.1)",
        }),
        stroke: new Stroke({
          color: "rgba(0, 0, 255, 1.0)",
          width: 3,
        }),
      }),
    }),
  ];
};
const styleGreen = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(40, 210, 100, 1.0)",
        width: 3,
      }),
      fill: new Fill({
        color: "rgba(40, 210, 100, 0.1)",
      }),
      image: new Circle({
        radius: 4,
        fill: new Fill({
          color: "rgba(40, 210, 100, 0.1)",
        }),
        stroke: new Stroke({
          color: "rgba(40, 210, 100, 1.0)",
          width: 3,
        }),
      }),
    }),
  ];
};
const styleRed = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(230, 20, 20, 1.0)",
        width: 2,
        lineDash: [5, 5],
      }),
      fill: new Fill({
        color: "rgba(230, 20, 20, 0.3)",
      }),
      image: new Circle({
        radius: 10,
        fill: new Fill({
          color: "rgba(230, 20, 20, 0.1)",
        }),
        stroke: new Stroke({
          color: "rgba(230, 20, 20, 1.0)",
          width: 3,
        }),
      }),
    }),
  ];
};

const size = 256;
const canvas = document.createElement("canvas");
canvas.width = size;
canvas.height = size;

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Failed to get the canvas context");
}
context.strokeStyle = "white";
context.textAlign = "center";
context.font = "24px sans-serif";
const lineHeight = 30;

const collection1DisplayButton = document.getElementById(
  "collection1DisplayButton"
)!;
const collection2DisplayButton = document.getElementById(
  "collection2DisplayButton"
)!;

let coll1: string | null = null;
let coll2: string | null = null;
let coll1Url = `/collections/eb8ace56-83a5-44e7-80d1-5ec9fefc8013/{z}/{x}/{y}.vector.pbf`;
let coll2Url = `/collections/eb8ace56-83a5-44e7-80d1-5ec9fefc8013/{z}/{x}/{y}.vector.pbf`;

const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    new VectorTileLayer({
      //declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        url: coll2Url,
      }),
      style: styleBlue(),
    }),
    new VectorTileLayer({
      declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        url: coll1Url,
      }),
      style: styleGreen(),
    }),
    new VectorTileLayer({
      //declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        url: "",
      }),
      style: styleRed(),
    }),
    new VectorLayer({
      source: deltaLayer,
      style: styleRed(),
    }),
    new VectorLayer({
      source: drawLayer,
      style: drawStyle(),
    }),
    new VectorLayer({
      source: prefabLayer1,
      style: styleRed(),
    }),
    new VectorLayer({
      source: prefabLayer2,
      style: styleGreen(),
    }),
    // Vector Tile position overlay
    new TileLayer({
      source: new DataTile({
        loader: function (z, x, y) {
          const half = size / 2;
          context.clearRect(0, 0, size, size);
          context.fillStyle = "rgba(100, 100, 100, 0)";
          context.fillRect(0, 0, size, size);
          context.fillStyle = "black";
          context.fillText(`z: ${z}`, half, half - lineHeight);
          context.fillText(`x: ${x}`, half, half);
          context.fillText(`y: ${y}`, half, half + lineHeight);
          context.strokeRect(0, 0, size, size);
          const data = context.getImageData(0, 0, size, size);
          // converting to Uint8Array for increased browser compatibility
          return new Uint8Array(data.data.buffer);
        },
        // disable opacity transition to avoid overlapping labels during tile loading
        transition: 0,
      }),
    }),
  ],
  target: "map",

  view: new View({
    //projection: "EPSG:4326",
    center: [14483488.424272656, 580557.970539473],
    zoom: 4,
  }),
});

// Create listeners for jumping to a specific location
// TODO fix mercator
const tileCoordZ = document.getElementById("tileCoordZ");
const tileCoordX = document.getElementById("tileCoordX");
const tileCoordY = document.getElementById("tileCoordY");
const lonlatZoom = document.getElementById("lonlatZoom");
const lon = document.getElementById("lon");
const lat = document.getElementById("lat");

document
  .getElementById("deltaButton")
  ?.addEventListener("click", async function () {
    const response = await fetch(
      `http://localhost:3000/delta/${coll1}/${coll2}`,
      { method: "GET" }
    );
    const collId = await response.json();
    console.log(collId);

    const deltaUrl = `http://localhost:3000/collections/${collId.newColl}/{z}/{x}/{y}.vector.pbf`;
    const layers = map.getLayers().getArray();
    (layers[1] as VectorTileLayer).getSource()?.clear();
    (layers[1] as VectorTileLayer).getSource()?.setUrl("");
    (layers[1] as VectorTileLayer).getSource()?.refresh();
    //(layers[2] as VectorTileLayer).getSource()?.clear();
    //(layers[2] as VectorTileLayer).getSource()?.setUrl("");
    //(layers[2] as VectorTileLayer).getSource()?.refresh();
    (layers[3] as VectorTileLayer).getSource()?.setUrl(deltaUrl);
    (layers[3] as VectorTileLayer).getSource()?.clear();
    (layers[3] as VectorTileLayer).getSource()?.refresh();

    await fetch("http://localhost:3000/dropCache");
  });

document
  .getElementById("lonlatJumpButton")
  ?.addEventListener("click", function () {
    if (lon && lat && lonlatZoom) {
      const lonV = parseFloat((<HTMLInputElement>lon).value);
      const latV = parseFloat((<HTMLInputElement>lat).value);
      const zoomV = parseInt((<HTMLInputElement>lonlatZoom).value);

      map.getView().setCenter([lonV, latV]);
      map.getView().setZoom(zoomV);
    } else {
      console.log("Error");
    }
  });

document
  .getElementById("tileJumpButton")
  ?.addEventListener("click", function () {
    if (tileCoordX && tileCoordY && tileCoordZ) {
      const x = parseFloat((<HTMLInputElement>tileCoordX).value);
      const y = parseFloat((<HTMLInputElement>tileCoordY).value);
      const z = parseInt((<HTMLInputElement>tileCoordZ).value);

      const tileCenterX = x + 0.5;
      const tileCenterY = y + 0.5;

      const xAs4326 = (tileCenterX / Math.pow(2, z)) * 360 - 180;
      const yAs4326 =
        (Math.atan(
          Math.sinh(Math.PI * (1 - (2 * tileCenterY) / Math.pow(2, z)))
        ) *
          180) /
        Math.PI;

      const xAs3857 = transform(
        [xAs4326, yAs4326],
        "EPSG:4326",
        "EPSG:3857"
      )[0];
      const yAs3857 = transform(
        [xAs4326, yAs4326],
        "EPSG:4326",
        "EPSG:3857"
      )[1];
      const centerX = xAs3857;
      const centerY = yAs3857;
      map.getView().setCenter([centerX, centerY]);
      map.getView().setZoom(z);
    } else {
      console.log("Error");
    }
  });

collection1DisplayButton.addEventListener("click", async function () {
  console.log("coll1 changed");
  const collection1Input = document.getElementById("collection1Input");
  coll1 = (<HTMLInputElement>collection1Input).value;
  coll1Url = `/collections/${coll1}/{z}/{x}/{y}.vector.pbf`;
  console.log("now coll1Url is", coll1Url);
  const layers = map.getLayers().getArray();

  (layers[2] as VectorTileLayer).getSource()?.clear();
  (layers[2] as VectorTileLayer).getSource()?.setUrl(coll1Url);
  console.log(
    "layer source",
    (layers[2] as VectorTileLayer).getSource()?.getUrls()
  );
  await fetch(`http://localhost:3000/dropCache`);
});

collection2DisplayButton.addEventListener("click", async function () {
  console.log("coll2 changed");
  const collection2Input = document.getElementById("collection2Input");
  coll2 = (<HTMLInputElement>collection2Input).value;
  coll2Url = `/collections/${coll2}/{z}/{x}/{y}.vector.pbf`;
  console.log("now coll2Url is", coll2Url);
  const layers = map.getLayers().getArray();
  // hide layer 1
  (layers[1] as VectorTileLayer).getSource()?.clear();
  (layers[1] as VectorTileLayer).getSource()?.setUrl("");
  (layers[1] as VectorTileLayer).getSource()?.refresh();
  (layers[1] as VectorTileLayer).getSource()?.setUrl(coll2Url);
  console.log(
    "layer source",
    (layers[1] as VectorTileLayer).getSource()?.getUrls()
  );
  await fetch(`http://localhost:3000/dropCache`);
});
document
  .getElementById("prefabSelectButton")
  ?.addEventListener("click", function () {
    console.log("prefabSelectButton");
    const selectedPrefab = document.getElementById("prefabProvider")!;
    const selectedPrefabValue = (<HTMLInputElement>selectedPrefab).value;

    if (selectedPrefabValue) {
      switch (selectedPrefabValue) {
        case "titanic":
          prefabLayer1.addFeature(
            new Feature({
              geometry: new LineString(
                titanicSeaRoutePlanned.geometry.coordinates
              ),
            })
          );
          prefabLayer2.addFeature(
            new Feature({
              geometry: new LineString(
                titanicSeaRouteActual.geometry.coordinates
              ),
            })
          );
          break;
        case "philippines":
          prefabLayer1.addFeature(
            new Feature({
              geometry: new Polygon(philippineSea1.geometry.coordinates),
            })
          );
          prefabLayer2.addFeature(
            new Feature({
              geometry: new Polygon(philippineSea2.geometry.coordinates),
            })
          );
          break;
        case "africaL":
          prefabLayer1.addFeature(
            new Feature({
              geometry: new Polygon(africaL.geometry.coordinates),
            })
          );
          prefabLayer2.addFeature(
            new Feature({
              geometry: new Polygon(africaLWestCoastPatch.geometry.coordinates),
            })
          );
          break;
        case "clusterStress":
          prefabLayer1.addFeature(
            new Feature({
              geometry: new MultiPolygon(clusterStress.geometry.coordinates),
            })
          );
          prefabLayer2.addFeature(
            new Feature({
              geometry: new MultiPolygon(
                clusterStressPatchPolys.geometry.coordinates
              ),
            })
          );
          prefabLayer2.addFeature(
            new Feature({
              geometry: new MultiPoint(
                clusterStressPatchPoints.geometry.coordinates
              ),
            })
          );

          break;
        case "midway":
          throw new Error("Not implemented");
      }
    }
  });

document
  .getElementById("prefabClearButton")
  ?.addEventListener("click", function () {
    prefabLayer1.clear();
    prefabLayer2.clear();
    // clear all layers except base map
    const layers = map.getLayers().getArray();
    for (let i = 1; i < layers.length; i++) {
      (layers[i] as VectorTileLayer).getSource()?.clear();
    }
  });

// Create interation for drawing a polygon
drawLayer.on("addfeature", function (e) {
  console.log("drawlayer");
  if (e.feature) {
    console.log(
      e.feature
        .getGeometry()
        ?.getSimplifiedGeometry(0.1)
        //@ts-expect-error - getCoordinates() is not in the type definition
        .getCoordinates()
        .toString()
    );
  }
});
drawLayer.on("changefeature", function (e) {
  console.log("changefeature");
  if (e.feature)
    console.log(e.feature.getGeometry()?.getSimplifiedGeometry(0.1));
});

const modify = new Modify({
  source: drawLayer,
});
map.addInteraction(modify);
let draw: Interaction, snap: Interaction; // global so we can remove them later
const typeSelect = document.getElementById("type")!;
function addInteractions() {
  draw = new Draw({
    source: drawLayer,
    type: (<HTMLInputElement>typeSelect).value as Type,
  });
  map.addInteraction(draw);
  snap = new Snap({ source: drawLayer });
  map.addInteraction(snap);
}

/**
 * Handle change event.
 */
typeSelect.onchange = function () {
  console.log("typeSelectValue: " + (<HTMLInputElement>typeSelect).value);
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  addInteractions();
};

addInteractions();
/*map.getLayers()[1].on("tileloadend", function (e) {
  console.log("tileloadend");
});*/
//@ts-expect-error - just for debugging
window.map = map;
