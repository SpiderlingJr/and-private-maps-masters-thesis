import { DeltaPolyPaths } from "../dbPlugin";

interface PolyDescription {
  points: number[][];
  ppath: number[][];
}

function convert3857To4326(x: number, y: number): number[] {
  const lon = (x / 20037508.34) * 180;
  const lat = (y / 20037508.34) * 180;

  const lat2 =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

  return [lon, lat2];
}

/**
 * Takes the output of ST_DumpPoints and returns an array of point pairs
 * intended as input for a line rasterization algorithm i.e Bresenham
 */
export function parsePolyPoints(poly: DeltaPolyPaths[]): PolyDescription {
  const points = poly.map((p) => p.geom);
  const ppath = poly.map((p) => p.path); // Path that connects the points to polygons

  const parsedPoints: Array<Array<number>> = [];
  // parse the wkt string into an array of coordinates
  for (let i = 0; i < points.length; i++) {
    // They all start with 'POINT(' and end with a '), just slice
    const splitPoints = points[i].slice(6, -1).split(" ");
    const numPoints = splitPoints.map((c) => parseFloat(c));

    parsedPoints.push(numPoints);
    // Parse point's coordinates to float
  }

  return {
    points: parsedPoints,
    ppath: ppath,
  } satisfies PolyDescription;
}

/** Bresenham implementation based on https://www.cs.helsinki.fi/group/goa/mallinnus/lines/bresenh.html
 *
 * @param {*} x0
 * @param {*} y0
 * @param {*} x1
 * @param {*} y1
 * @returns
 */
export function bresenham(x0: number, y0: number, x1: number, y1: number) {
  // Find the height and width of the line
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  // Find the direction of the line and configure direction of algorithm accordingly
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  const points = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    points.push([x, y]);
    if (x == x1 && y == y1) break;

    const e2 = 2 * err;

    // If the error is greater than the height of the line, move in the x direction
    if (e2 > -dy) {
      err -= dy;
      x += sx;

      if (x % 1 === 0 && y % 1 === 0) {
        //points.push([x, y - sy]);
        points.push([x, y + sy]);
      }
    }
    // If the error is less than the width of the line, move in the y direction
    if (e2 < dx) {
      err += dx;
      y += sy;

      if (x % 1 === 0 && y % 1 === 0) {
        points.push([x, y - sy]);
        //points.push([x, y + sy]);
      }

      // Also push a point moving in the x direction
      //points.push([x0 - sx, y0]);
    }
  }
  return points;
}

/**
 * Find the MVT that a point intersects given a zoom level
 * given a zoom level
 * @param x x coordinate in epsg 3857
 * @param y y coordinate in epsg 3857
 * @param zoom zoom level
 * @returns [x,y] vector tile coordinate
 *
 */
export function findWrappingMVT(
  x: number,
  y: number,
  zoom: number
): [number, number] {
  const lonlat = convert3857To4326(x, y);
  const lon = lonlat[0];
  const lat = lonlat[1];

  const tileCount = Math.pow(2, zoom);

  const tileX = Math.floor(((lon + 180) / 360) * tileCount);
  const tileY = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      tileCount
  );
  /*
  const tileX = Math.floor(
    (x + 20037508.342789244) / ((20037508.342789244 * 2) / 2 ** zoom)
  );

  const tileY = Math.floor(
    tileCount -
      1 -
      (y + 20037508.342789244) / ((20037508.342789244 * 2) / tileCount)
  );
  */
  //console.log(`{x: ${x}, y: ${y}} -> {tileX: ${tileX}, tileY: ${tileY}}`);
  //console.log("tileX", tileX, "tileY", tileY);
  return [tileX, tileY];
}

/**
 * Takes a polygon description and returns a set of MVTs that the polygon intersects
 * given a zoom level
 * @param polyDescription
 * @returns the MVT keys in format "z/x/y"
 */
export function rasterize(
  polyDescription: PolyDescription,
  zoom: number
): Set<number[]> {
  const points = polyDescription.points;
  const ppath = polyDescription.ppath;

  console.log("Points: ", points);
  const mvt = new Set<number[]>();
  for (let i = 0; i < points.length - 1; i++) {
    // In case of multiple polygons, only connect points that belong to the same polygon
    const currentPoly = ppath[i][0];

    // Only connect points that belong to the same polygon
    if (ppath[i + 1][0] !== currentPoly) {
      continue;
    }
    const p1 = points[i];
    const p2 = points[i + 1];

    // convert to MVT coordinates
    const mvt_p1 = findWrappingMVT(p1[0], p1[1], zoom);
    const mvt_p2 = findWrappingMVT(p2[0], p2[1], zoom);

    console.log(`P1 ${p1} -> MVT "${zoom}/${mvt_p1[0]}/${mvt_p1[1]}"`);
    console.log(`P2 ${p2} -> MVT "${zoom}/${mvt_p2[0]}/${mvt_p2[1]}"`);

    const line = bresenham(mvt_p1[0], mvt_p1[1], mvt_p2[0], mvt_p2[1]);

    console.log("Line: ", line);
    //console.log("Point1 : ", p1, "MVT: ", mvt_p1);
    //console.log("Point2 : ", p2, "MVT: ", mvt_p2);
    // Add the line to the set of MVTs
    for (const p of line) {
      mvt.add([zoom, p[0], p[1]]);
    }
  }
  return mvt;
}
/**
 * Takes a set of MVT Coordinates and a zoom level and returns the set of their parents
 * @param mvt set of MVT coordinates in format [x, y]
 * @param zoom zoom level
 * @returns the MVT keys in format "z/x/y"
 */
export function findMvtParents(zoom: number, mvt: Set<string>): Set<string> {
  if (zoom === 0) {
    return new Set<string>(["0/0/0"]);
  }
  const parents = new Set<string>();

  // TODO laufzeit messen?
  // TODO getParent-lookup table? inMemory, wenn möglich für konstante lookup time
  for (const m of mvt) {
    const [z, x, y] = m.split("/");
    const parent = calcMvtParent(parseInt(z), parseInt(x), parseInt(y));

    parents.add(parent);
  }
  return new Set([...mvt, ...findMvtParents(zoom - 1, parents)]);
}
/**
 * Takes coordinates of a MVT and a zoom level and returns the coordinates of its parent
 * @param x x coordinate of MVT
 * @param y y coordinate of MVT
 * @param zoom zoom level
 * @returns the MVT keys in format "z/x/y"
 * @example
 * calcMvtParent(0, 0, 1) // returns [0, 0, 0]
 * calcMvtParent(3, 3, 2) // returns [2, 1, 1]
 *
 */
function calcMvtParent(zoom: number, x: number, y: number): string {
  const parentZoom = zoom - 1;
  const parentX = Math.floor(x / 2);
  const parentY = Math.floor(y / 2);
  return `${parentZoom}/${parentX}/${parentY}`;
}