import MVT from "ol/format/MVT";
import Map from "ol/Map";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import View from "ol/View";
import { createMapboxStreetsV6Style } from "./style";

const _map = new Map({
  layers: [
    new VectorTileLayer({
      declutter: true,
      source: new VectorTileSource({
        format: new MVT(),
        url: "http://localhost:3000/collection/ID/{z}/{x}/{y}.vector.pbf",
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
