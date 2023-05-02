/**
 *  Utility functions for the eviction plugin
 *  Provides functions for rasterizing polygons and finding the parents of a
 *  set of MVTs
 */
import { DeltaPolyPaths } from "../dbPlugin";

interface PolyDescription {
  points: number[][];
  ppath: number[][];
}

export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
/**
 * Converts a point from EPSG:3857 to EPSG:4326
 * @param x  x coordinate in EPSG:3857
 * @param y  y coordinate in EPSG:3857
 * @returns  [lon, lat] in EPSG:4326
 */
function convert3857To4326(x: number, y: number): [number, number] {
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
 * @param poly  Array of points in EPSG:3857
 *
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

/** Bresenham implementation based on
 * https://www.cs.helsinki.fi/group/goa/mallinnus/lines/bresenh.html
 * extended using http://eugen.dedu.free.fr/projects/bresenham/
 *
 * Algorithm that shoots a ray from p1 to p2 and returns all the points that
 * the ray intersects. This is used to rasterize a line.
 * Difference between this and Bresenham's algorithm is that this algorithm
 * returns all the points that the ray intersects, not just the points that
 * are closest to the line. This results in a line that is thicker than 1 pixel.
 *
 * @param p1 Starting point
 * @param p2 End point
 * @returns an array of points that form a line between p1 and p2, including p1
 *  and p2
 */
export function supercoverLine(p1: Point, p2: Point): Point[] {
  const points: Point[] = [];
  let i: number;
  let ystep: number;
  let xstep: number;
  let error: number;
  let errorprev: number;
  let y = p1.y;
  let x = p1.x;

  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  points.push({ x: p1.x, y: p1.y });
  if (dy < 0) {
    ystep = -1;
    dy = -dy;
  } else {
    ystep = 1;
  }
  if (dx < 0) {
    xstep = -1;
    dx = -dx;
  } else {
    xstep = 1;
  }
  const ddy = 2 * dy;
  const ddx = 2 * dx;
  if (ddx >= ddy) {
    errorprev = error = dx;
    for (i = 0; i < dx; i++) {
      x += xstep;
      error += ddy;
      if (error > ddx) {
        y += ystep;
        error -= ddx;
        if (error + errorprev < ddx) {
          //points.push({ x: x - xstep, y: y - ystep });
          points.push({ x, y: y - ystep });
        } else if (error + errorprev > ddx) {
          points.push({ x: x - xstep, y });
        } else {
          points.push({ x: x - xstep, y });
          points.push({ x, y: y - ystep });
        }
      }
      points.push({ x, y });
      errorprev = error;
    }
  } else {
    errorprev = error = dy;
    for (i = 0; i < dy; i++) {
      y += ystep;
      error += ddx;
      if (error > ddy) {
        x += xstep;
        error -= ddy;
        if (error + errorprev < ddy) {
          //points.push({ x: x - xstep, y });
          points.push({ x: x - xstep, y });
        } else if (error + errorprev > ddy) {
          points.push({ x, y: y - ystep });
        } else {
          points.push({ x: x - xstep, y });
          points.push({ x, y: y - ystep });
        }
      }
      points.push({ x, y });
      errorprev = error;
    }
  }
  // assert ((y == y2) && (x == x2));
  return points;
}

/**
 * Find the MVT that a point intersects given a zoom level
 * given a zoom level
 * @param x x coordinate
 * @param y y coordinate
 * @param zoom zoom level
 * @param mapping EPSG:3857 or EPSG:4326, default EPSG:3857
 * @returns [x,y] vector tile coordinate
 *
 */

export function findWrappingMVT(
  x: number,
  y: number,
  zoom: number,
  mapping: "EPSG:3857" | "EPSG:4326" = "EPSG:3857"
): [number, number] {
  let lonlat: [number, number] = [x, y];
  if (mapping === "EPSG:3857") {
    lonlat = convert3857To4326(x, y);
  }
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

    const line = supercoverLine(
      { x: mvt_p1[0], y: mvt_p1[1] },
      { x: mvt_p2[0], y: mvt_p2[1] }
    );

    console.log("Line: ", line);
    //console.log("Point1 : ", p1, "MVT: ", mvt_p1);
    //console.log("Point2 : ", p2, "MVT: ", mvt_p2);
    // Add the line to the set of MVTs
    for (const p of line) {
      mvt.add([zoom, p.x, p.y]);
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
