import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/WebGLTile";
import OSM from "ol/source/OSM";
import MVT from "ol/format/MVT";
import DataTile from "ol/source/DataTile";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";

import VectorLayer from "ol/layer/Vector";
import { Style, Stroke, Fill } from "ol/style";
import { Interaction, Modify, Draw, Snap } from "ol/interaction";
import { Vector as VectorSource } from "ol/source";
import { Type } from "ol/geom/Geometry";
import { transform } from "ol/proj";

import * as turf from "@turf/turf";

import Feature from "ol/Feature";
import { MultiPolygon, Polygon } from "ol/geom";

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

drawLayer.addFeature(
  new Feature({
    geometry: new Polygon(postgisCalcedDelta.geometry.coordinates),
  })
);

const poly1 = turf.polygon([
  [
    [1366163.7838552229, 6197542.917247698],
    [1366325.018211762, 6197517.836347791],
    [1366498.1958539705, 6197473.646190815],
    [1366537.60869668, 6197440.204990939],
    [1366554.3292966175, 6197504.698733555],
    [1366703.620367487, 6197412.7354339],
    [1366598.519453595, 6197373.32259119],
    [1366603.2967678627, 6197296.885562905],
    [1366452.8113684263, 6197287.330934369],
    [1366444.4510684574, 6197226.420177454],
    [1366174.5328123255, 6197252.6954059275],
    [1366098.0957840404, 6197290.91392007],
    [1366163.7838552229, 6197542.917247698],
  ],
]);

const poly2 = turf.polygon([
  [
    [1366399.0665829133, 6197575.164119005],
    [1366389.5119543776, 6197685.042347166],
    [1366470.7262969306, 6197685.042347166],
    [1366694.0657389513, 6197569.192476171],
    [1366790.8063528747, 6197534.556947729],
    [1366751.3935101652, 6197415.124091034],
    [1366739.4502244957, 6197416.318419601],
    [1366703.620367487, 6197412.7354339],
    [1366598.519453595, 6197373.32259119],
    [1366603.2967678627, 6197296.885562905],
    [1366452.8113684263, 6197287.330934369],
    [1366444.4510684574, 6197226.420177454],
    [1366174.5328123255, 6197252.6954059275],
    [1366098.0957840404, 6197290.91392007],
    [1366163.7838552229, 6197542.917247698],
    [1366325.018211762, 6197517.836347791],
    [1366395.4835972125, 6197498.72709072],
    [1366399.0665829133, 6197575.164119005],
  ],
]);

const intersect = turf.intersect(poly1, poly2);
const union = turf.union(poly1, poly2);

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

const drawStyle = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(0, 255, 0, 1.0)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(0, 255, 0, 0.2)",
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
        color: "rgba(0, 0, 255, 0.2)",
      }),
    }),
  ];
};
const styleGreen = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(0, 255, 0, 1.0)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(0, 255, 0, 0.2)",
      }),
    }),
  ];
};
const styleRed = function () {
  return [
    new Style({
      stroke: new Stroke({
        color: "rgba(255, 0, 0, 1.0)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(255, 0, 0, 0.2)",
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

const coll1 = "eb8ace56-83a5-44e7-80d1-5ec9fefc8013";
const coll2 = "6b62af50-aa44-48b8-9ca8-b0c3fb095ce9";

const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),

    new VectorTileLayer({
      //declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        tileLoadFunction: function (tile, url) {
          console.log("tileLoadFunction", url);
          //console.log(VectorTileSource.prototype.tileLoadFunction);
          //VectorTileSource.prototype.tileLoadFunction(tile, url);
        },

        url: `/collections/${coll1}/{z}/{x}/{y}.vector.pbf`,
      }),

      style: styleGreen(),
    }),
    new VectorTileLayer({
      //declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        url: `/collections/${coll2}/{z}/{x}/{y}.vector.pbf`,
      }),
      style: styleBlue(),
    }),
    new VectorLayer({
      source: deltaLayer,
      style: styleRed(),
    }),
    new VectorLayer({
      source: drawLayer,
      style: drawStyle(),
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
    center: [0, 0],
    zoom: 2,
  }),
});

// Create listeners for jumping to a specific location
const tileCoordZ = document.getElementById("tileCoordZ");
const tileCoordX = document.getElementById("tileCoordX");
const tileCoordY = document.getElementById("tileCoordY");
const lonlatZoom = document.getElementById("lonlatZoom");
const lon = document.getElementById("lon");
const lat = document.getElementById("lat");

document.getElementById("deltaButton")?.addEventListener("click", function () {
  const layers = map.getLayers().getArray();

  const layerSource1 = (layers[1] as VectorTileLayer).getSource();
  const layerSource2 = (layers[2] as VectorTileLayer).getSource();

  if (!layerSource1 || !layerSource2) {
    return;
  }
  const feature1 = layerSource1.getFeaturesInExtent(
    map.getView().calculateExtent(map.getSize())
  )[0];
  const feature2 = layerSource2.getFeaturesInExtent(
    map.getView().calculateExtent(map.getSize())
  )[0];

  const ft1 = feature1 as Feature;
  const ft2 = feature2 as Feature;

  console.log("Ft1:", ft1);
  console.log("Ft2:", ft2);
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

// Create interation for drawing a polygon
drawLayer.on("addfeature", function (e) {
  console.log("drawlayer");

  if (e.feature) {
    console.log(e.feature);
    console.log(e.feature.getGeometry()?.getSimplifiedGeometry(0.1));
  }
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

//@ts-expect-error - just for debugging
window.map = map;
