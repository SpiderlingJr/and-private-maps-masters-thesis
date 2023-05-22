/**
 * This is a collection of test data for the tileWalker.js script.
 * Exported projection is mercator.
 *
 * In all cases, 'E' denotes the existing data and 'N' denotes the new data.
 * All cases assume a modifying operation, not adding or deleting. This means
 * all updated features already exist in the database, but may have their geometry
 * modified.
 *
 * Following cases are covered:
 *
 * 1. E and N are disjoint
 * 2. E and N are identical
 * 3. E is a subset of N ("N expands E")
 * 4. N is a subset of E ("N reduces E")
 *
 * The test data is structured as follows:
 * {
 *  existingData: <existing data>,
 * newData: <new data>,
 * zoomLevel: <zoom level>
 * }
 * where <existing data> and <new data> are GeoJSON FeatureCollections.
 */

/**
 * Polygon that resides in tiles
 * 4/13/6, 4/14/6
 * 4/13/7, 4/14/7
 *
 * Reference: Japanese strategical offensive area of the Kido Butai (1941–42)
 */

import * as turf from "@turf/turf";
export const philippineSea1 = turf.toMercator(
  turf.polygon([
    [
      [123.93122361284969, 35.039003591441016],
      [123.81063776923963, 11.040621043622352],
      [156.67402114902075, 0.7861247603822648],
      [153.09543721636254, 31.842657907181447],
      [123.93122361284969, 35.039003591441016],
    ],
  ])
);

/**
 * Polygon that resides in tiles
 * 4/13/6, 4/14/6
 * 4/13/7, 4/14/7
 *
 * Unchanged tiles: 4/13/6
 *
 * Reference: Japanese strategical offensive area, excluding the Battleground
 * of the Battle of Midway in 1942.
 */
export const philippineSea2 = turf.toMercator(
  turf.polygon([
    [
      [123.93122361284969, 35.039003591441016],
      [123.81063776923963, 11.040621043622352],
      [124.63608662136772, 9.00725758925455],
      [153.09543721636254, 31.842657907181447],
      [123.93122361284969, 35.039003591441016],
    ],
  ])
);

/**
 * LineString that resides in tiles
 *
 * 4/4/4, 4/4/6,
 * 4/5/5, 4/6/5, 4/7/5
 *
 * Reference: Titanic's planned sea route from Southampton to New York,
 * including the stops at Cherbourg and Queenstown.
 */
export const titanicSeaRoutePlanned = turf.lineString([
  [-573873.3354987949, 7319379.702908587],
  [-8077.236149098724, 6692691.514687512],
  [-247495.15046971105, 6309799.103385645],
  [-886122.9639596837, 6751650.521372497],
  [-8224557.786374791, 4870562.560257655],
]);

/**
 * LineString that resides in tiles
 *
 *  4/5/5, 4/6/5, 4/7/5
 *
 *  Reference: Titanic's actual sea route, ending at the sinking location.
 */
export const titanicSeaRouteActual = turf.lineString([
  [-573873.3354987949, 7319379.702908587],
  [-8077.236149098724, 6692691.514687512],
  [-247495.15046971105, 6309799.103385645],
  [-886122.9639596837, 6751650.521372497],
  [-5560214.089973594, 5120162.394070463],
]);

//console.log(JSON.stringify(turf.toWgs84(titanicSeaRoutePlanned.geometry)));
//console.log(JSON.stringify(turf.toWgs84(titanicSeaRouteActual.geometry)));

/**
 * Polygon that resides in tiles
 *
 * Test case: Long diagonal polygon that spans multiple tiles
 * For redundancy testing in cache eviction strat#2
 *
 *
 * Reference: Italy
 */
export const italy = turf.polygon([
  [
    [1003993.2737107273, 5534398.060967345],
    [1353595.9115456953, 5658590.931226213],
    [1562509.6682267557, 5267297.3596650865],
    [1805000.614151368, 5142975.812308172],
    [1776853.28300395, 5078825.281157998],
    [1974584.845613509, 4976051.88502266],
    [2063459.6373195387, 4890181.267598357],
    [2048126.1567244604, 4837290.919343896],
    [1949951.2417217214, 4909513.019688054],
    [1902265.8364215535, 4935181.359986971],
    [1835889.5278638985, 4825721.253353604],
    [1915679.8966118656, 4774312.672642888],
    [1922391.6158448183, 4712209.731663922],
    [1880217.510501658, 4707898.85098286],
    [1848184.4471667414, 4689861.300925039],
    [1844630.080716873, 4638612.150899408],
    [1791996.0719952965, 4570378.943774276],
    [1743929.2834876669, 4569822.499422406],
    [1745986.2519344683, 4610067.806085207],
    [1807138.860986644, 4710865.51216221],
    [1740540.5999066138, 4875197.9092920935],
    [1587420.94426431, 4963407.611600903],
    [1287490.9131857015, 5195197.9719733],
    [1003993.2737107273, 5534398.060967345],
  ],
]);

/**
 * Polygon that resides in tiles
 *
 * Test case: Long diagonal polygon that spans multiple tiles
 * For redundancy testing in cache eviction strat#2
 *
 *
 * Reference: Italy, including the island of Elba
 */
export const italyWithElba = turf.polygon([
  [
    [1003993.2737107273, 5534398.060967345],
    [1353595.9115456953, 5658590.931226213],
    [1562509.6682267557, 5267297.3596650865],
    [1805000.614151368, 5142975.812308172],
    [1776853.28300395, 5078825.281157998],
    [1974584.845613509, 4976051.88502266],
    [2063459.6373195387, 4890181.267598357],
    [2048126.1567244604, 4837290.919343896],
    [1949951.2417217214, 4909513.019688054],
    [1902265.8364215535, 4935181.359986971],
    [1835889.5278638985, 4825721.253353604],
    [1915679.8966118656, 4774312.672642888],
    [1922391.6158448183, 4712209.731663922],
    [1880217.510501658, 4707898.85098286],
    [1848184.4471667414, 4689861.300925039],
    [1844630.080716873, 4638612.150899408],
    [1791996.0719952965, 4570378.943774276],
    [1743929.2834876669, 4569822.499422406],
    [1745986.2519344683, 4610067.806085207],
    [1807138.860986644, 4710865.51216221],
    [1740540.5999066138, 4875197.9092920935],
    [1587420.94426431, 4963407.611600903],
    [1287490.9131857015, 5195197.9719733],
    [1113921.7183274191, 5261462.295430639],
    [1003993.2737107273, 5534398.060967345],
  ],
]);

/* Sanity check to viualize the polygon using geojson.io */
/*
const a = turf.toWgs84(italia.geometry);
console.log(JSON.stringify(a));
console.log();
console.log(JSON.stringify(turf.toWgs84(italiaWithElba.geometry)));
*/

export const setzensack1 = turf.polygon([
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

export const setzensack2 = turf.polygon([
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

/** Big quadrangle for tests on low zoom levels
 *
 * Corner points reside in the following tiles:
 * 4x4 on zoom level 3
 * Upper Left: 3/3/1
 * Lower Left: 3/3/4
 * Lower Right: 3/6/4
 * Upper Right: 3/6/1
 *
 * Ref: imgs/bigQuadrangle.png
 */
export const bigQuadrangle = turf.polygon([
  [
    [-2450478.684056025, 12441269.68254023],
    [-2410826.808284878, -2654260.1151822116],
    [13024171.59935586, -2662959.251193231],
    [12932021.44928567, 12601293.324045219],
    [-2450478.684056025, 12441269.68254023],
  ],
]);

console.log(
  "bigQuadrangleJSON",
  JSON.stringify(turf.toWgs84(bigQuadrangle.geometry))
);
