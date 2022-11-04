import MVT from "ol/format/MVT";
import Map from "ol/Map";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { createMapboxStreetsV6Style } from "./style";
import { OutgoingMessage } from "http";
import OSM from "ol/source/OSM";

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
        url: "/collections/e6d34436-a223-4860-8f86-d5c8cb7dbdc9/{z}/{x}/{y}.vector.pbf",
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
