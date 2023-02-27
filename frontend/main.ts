import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/WebGLTile";
import OSM from "ol/source/OSM";
import MVT from "ol/format/MVT";
import DataTile from "ol/source/DataTile";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import { createMapboxStreetsV6Style } from "./style";
import Vector from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Style, Stroke, Fill } from "ol/style";
import { Interaction, Modify, Draw, Snap } from "ol/interaction";
import { Vector as VectorSource } from "ol/source";
import { Type } from "ol/geom/Geometry";

const drawLayer = new VectorSource();
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

const coll1 = "0a0963f7-bb2d-46df-87c4-fe3890bb8e74";
//const coll1 = "a5640fe2-fa1c-471d-9965-45a4931ae710";
const coll2 = "";
const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    new VectorTileLayer({
      //declutter: true,
      source: new VectorTileSource({
        //projection: "EPSG:4326",
        format: new MVT(),
        url: `/collections/${coll1}/{z}/{x}/{y}.vector.pbf`,
      }),
      style: createMapboxStreetsV6Style(),
    }),
    /*new VectorTileLayer({
      declutter: true,
      source: new VectorTileSource({
        //projection: "EPSG:4326",
        format: new MVT(),
        url: `/collections/${coll2}/{z}/{x}/{y}.vector.pbf`,
      }),
      style: createMapboxStreetsV6Style(),
    }),*/
    new VectorLayer({
      source: drawLayer,
      style: drawStyle(),
    }),
    // Vector Tile position overlay
    new TileLayer({
      source: new DataTile({
        //projection: "EPSG:4326",
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

      const xAs4326 = (x / Math.pow(2, z)) * 360 - 180;
      const yAs4326 = (y / Math.pow(2, z)) * 360 - 180;
      map.getView().setCenter([xAs4326, yAs4326]);
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
