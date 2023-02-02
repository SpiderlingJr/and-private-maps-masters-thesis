import MVT from "ol/format/MVT";
import Map from "ol/Map";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { createMapboxStreetsV6Style } from "./style";
import OSM from "ol/source/OSM";

const coll = "25a40e78-a98a-403e-af7c-5501e50350d2";
const _map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),

    new VectorTileLayer({
      declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        // todo server cors option -> localhost:port to localhost
        // world f36c91f4-d71d-4fb8-8b74-fec8a7b1c4d2
        url: `/collections/${coll}/{z}/{x}/{y}.vector.pbf`,
        //TODO Blauer strich aus issue? wird linestring korrekt angezeigt in frontend? werden die richtigen requests gesendet=

        //mini
        //url: "/collections/e593d7a0-79f2-4321-a910-3fa15a3bee1e/{z}/{x}/{y}.vector.pbf",
        //url: "http://localhost:3000/collections/e6d34436-a223-4860-8f86-d5c8cb7dbdc9/2/3/2.vector.pbf",
      }),
      style: createMapboxStreetsV6Style(),
    }),
  ],
  target: "map",
  view: new View({
    center: [0, 0],
    zoom: 2,
  }),
});
