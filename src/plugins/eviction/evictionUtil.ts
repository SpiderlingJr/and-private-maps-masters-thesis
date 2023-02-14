import { DeltaPolyPaths } from "../dbPlugin";

interface PolyDescription {
  points: number[][];
  ppath: number[][];
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

  const points = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    points.push([x0, y0]);
    if (x0 == x1 && y0 == y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

/**
 * Converts lat and lon geographic coordinate to a vector tile coordinate
 * given a zoom level
 * @param lat_deg latitude in degrees
 * @param lon_deg longitude in degrees
 * @param zoom zoom level
 * @returns [x,y] vector tile coordinate
 *
 */
export function findWrappingMVT(
  lat_deg: number,
  lon_deg: number,
  zoom: number
): [number, number] {
  /*console.assert(
      0 <= zoom && zoom <= 22,
      "Invalid zoom level, must be in bounds of [0,22]"
    );*/

  const lat_rad = lat_deg * (Math.PI / 180); //toRadians(lat_deg); // a lot slower than pythons math.radians(), one order of magnitude
  const n = 2.0 ** zoom;
  const xtile = Math.trunc(((lon_deg + 180.0) / 360.0) * n);
  const ytile = Math.trunc(
    ((1.0 - Math.asinh(Math.tan(lat_rad)) / Math.PI) / 2.0) * n
  );

  //console.log(`deg2num/lulz0: ${performance.now() - t0} milliseconds`);
  //console.log(`deg2num/lulz: ${t3 - t0} milliseconds`);
  //console.log(`deg2num/toRad: ${t1 - t0} milliseconds`);
  //console.log(`deg2num/toTilePos: ${t3 - t2} milliseconds`);

  return [xtile, ytile];
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

  const mvt = new Set<number[]>();
  for (let i = 0; i < points.length - 1; i++) {
    // In case of multiple polygons, only connect points that belong to the same polygon
    const currentPoly = ppath[i][0];

    const p1 = points[i];
    const p2 = points[i + 1];

    // convert to MVT coordinates
    const mvt_p1 = findWrappingMVT(p1[0], p1[1], zoom);
    const mvt_p2 = findWrappingMVT(p2[0], p2[1], zoom);

    // Only connect points that belong to the same polygon
    if (ppath[i + 1][0] !== currentPoly) {
      continue;
    }

    const line = bresenham(mvt_p1[0], mvt_p1[1], mvt_p2[0], mvt_p2[1]);

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

  for (const m of mvt) {
    const [z, x, y] = m.split("/");
    const parent = calcMvtParent(parseInt(z), parseInt(x), parseInt(y));

    parents.add(parent);
  }
  //console.log("mvt", mvt);
  //console.log("parents", parents);
  //console.log("new set", new Set(...mvt, ...findMvtParents(zoom - 1, parents)));
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
