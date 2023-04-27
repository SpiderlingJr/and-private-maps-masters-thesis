/**
 * Tests evictionUtil.ts
 */

import { test } from "tap";
import {
  parsePolyPoints,
  supercoverLine,
  findWrappingMVT,
  Point,
} from "../src/plugins/eviction/evictionUtil.js";
function pointArraysEqual(arr: Point[], arr2: Point[], debug?: boolean) {
  if (arr.length !== arr2.length) {
    if (debug) {
      console.debug("Lengths not equal");
    }
    return false;
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].x !== arr2[i].x || arr[i].y !== arr2[i].y) {
      if (debug) {
        console.debug("Points not equal");
        console.debug(`Point ${i}: (${arr[i].x}, ${arr[i].y})`);
        console.debug(`Point ${i}: (${arr2[i].x}, ${arr2[i].y})`);
      }
      return false;
    }
  }
  return true;
}
test("Rasterizing lines", (t) => {
  /**  Tests the supercoverLine algorithm from evictionUtil.ts and its most
   *  common cases as well as known edge cases.
   *
   * Cases:
   * - Quadrant I / III (Ordering of points reversed)
   *   - a: m > 1
   *   - b: 0 < m < 1
   * - Quadrant II / IV (Ordering of points reversed)
   *   - a: -1 < m < 0
   *   - b: m < -1
   * - Horizontal line (m = 0)
   * - Vertical line (m = Infinity)
   * - Diagonal line (m = 1)
   * - Diagonal line (m = -1)
   * - Point (x1 = x2, y1 = y2)
   */

  // Quadrant I / III (Ordering of points reversed)
  // a: Input points: (0, 0), (3, 2), m = 2/3
  // aR: Input points: (3, 2), (0, 0), m = 2/3
  // b: Input points: (0, 0), (2, 3), m = 1.5
  // bR: Input points: (2, 3), (0, 0), m = 1.5

  // I a
  const result_Ia = supercoverLine(new Point(0, 0), new Point(2, 3));
  const expected_Ia = [
    new Point(0, 0),
    new Point(0, 1),
    new Point(1, 1),
    new Point(1, 2),
    new Point(2, 2),
    new Point(2, 3),
  ];
  const allEqual_Ia = pointArraysEqual(result_Ia, expected_Ia);
  t.equal(allEqual_Ia, true, "Quadrant I, case a");

  // I a Reversed
  const result_IaR = supercoverLine(new Point(2, 3), new Point(0, 0));
  const expected_IaR = expected_Ia.reverse();
  const allEqual_IaR = pointArraysEqual(result_IaR, expected_IaR);
  t.equal(allEqual_IaR, true, "Quadrant I, case a reversed");

  // I b
  const result_Ib = supercoverLine(new Point(0, 0), new Point(3, 2));
  const expected_Ib = [
    new Point(0, 0),
    new Point(1, 0),
    new Point(1, 1),
    new Point(2, 1),
    new Point(2, 2),
    new Point(3, 2),
  ];
  const allEqual_Ib = pointArraysEqual(result_Ib, expected_Ib);
  t.equal(allEqual_Ib, true, "Quadrant I, case b");

  // I b Reversed
  const result_IbR = supercoverLine(new Point(3, 2), new Point(0, 0));
  const expected_IbR = expected_Ib.reverse();
  const allEqual_IbR = pointArraysEqual(result_IbR, expected_IbR);
  t.equal(allEqual_IbR, true, "Quadrant I, case b reversed");

  // Horizontal line (m = 0)
  const result_H = supercoverLine(new Point(0, 0), new Point(3, 0));
  const expected_H = [
    new Point(0, 0),
    new Point(1, 0),
    new Point(2, 0),
    new Point(3, 0),
  ];
  const allEqual_H = pointArraysEqual(result_H, expected_H);
  t.equal(allEqual_H, true, "Horizontal line (m = 0)");

  // Horizontal line (m = 0) Reversed
  const result_HR = supercoverLine(new Point(3, 0), new Point(0, 0));
  const expected_HR = expected_H.reverse();
  const allEqual_HR = pointArraysEqual(result_HR, expected_HR);
  t.equal(allEqual_HR, true, "Horizontal line (m = 0) reversed");

  // Vertical line (m = Infinity)
  const result_V = supercoverLine(new Point(0, 0), new Point(0, 3));
  const expected_V = [
    new Point(0, 0),
    new Point(0, 1),
    new Point(0, 2),
    new Point(0, 3),
  ];
  const allEqual_V = pointArraysEqual(result_V, expected_V);
  t.equal(allEqual_V, true, "Vertical line (m = Infinity)");

  // Vertical line (m = Infinity) Reversed
  const result_VR = supercoverLine(new Point(0, 3), new Point(0, 0));
  const expected_VR = expected_V.reverse();
  const allEqual_VR = pointArraysEqual(result_VR, expected_VR);
  t.equal(allEqual_VR, true, "Vertical line (m = Infinity) reversed");

  // Diagonal line (m = 1)
  const result_D = supercoverLine({ x: 0, y: 0 }, { x: 3, y: 3 });
  const expected_D = [
    new Point(0, 0),
    new Point(0, 1),
    new Point(1, 0),
    new Point(1, 1),
    new Point(1, 2),
    new Point(2, 1),
    new Point(2, 2),
    new Point(2, 3),
    new Point(3, 2),
    new Point(3, 3),
  ];
  const allEqual_D = pointArraysEqual(result_D, expected_D);
  t.equal(allEqual_D, true, "Diagonal line (m = 1)");

  // Diagonal line (m = 1) Reversed
  const result_DR = supercoverLine(new Point(3, 3), new Point(0, 0));
  const expected_DR = expected_D.reverse();
  const allEqual_DR = pointArraysEqual(result_DR, expected_DR);
  t.equal(allEqual_DR, true, "Diagonal line (m = 1) reversed");

  // Diagonal line (m = -1)
  const result_Dm = supercoverLine(new Point(0, 3), new Point(3, 0));
  const expected_Dm = [
    new Point(0, 3),
    new Point(0, 2),
    new Point(1, 3),
    new Point(1, 2),
    new Point(1, 1),
    new Point(2, 2),
    new Point(2, 1),
    new Point(2, 0),
    new Point(3, 1),
    new Point(3, 0),
  ];
  const allEqual_Dm = pointArraysEqual(result_Dm, expected_Dm);
  t.equal(allEqual_Dm, true, "Diagonal line (m = -1)");

  // Diagonal line (m = -1) Reversed
  const result_DmR = supercoverLine(new Point(3, 0), new Point(0, 3));
  const expected_DmR = expected_Dm.reverse();

  const allEqual_DmR = pointArraysEqual(result_DmR, expected_DmR);
  t.equal(allEqual_DmR, true, "Diagonal line (m = -1) reversed");

  // Point (x1 = x2, y1 = y2)
  const result_P = supercoverLine(new Point(0, 0), new Point(0, 0));
  const expected_P = [
    {
      x: 0,
      y: 0,
    },
  ];
  const allEqual_P = pointArraysEqual(result_P, expected_P);
  t.equal(allEqual_P, true, "Point (x1 = x2, y1 = y2)");
  t.end();
});

test("parsePolyPoints", (t) => {
  const poly = [
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [1, 1, 1],
      geom: "POINT(1366395.5515403417 6197499.567978062)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [1, 1, 2],
      geom: "POINT(1366395.504254352 6197498.689782293)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [1, 1, 3],
      geom: "POINT(1366324.6943056888 6197517.886108183)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [1, 1, 4],
      geom: "POINT(1366395.5515403417 6197499.567978062)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 1],
      geom: "POINT(1366399.6288706062 6197575.292528696)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 2],
      geom: "POINT(1366389.2390888885 6197684.586008556)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 3],
      geom: "POINT(1366470.4081590632 6197684.782590383)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 4],
      geom: "POINT(1366694.152618517 6197569.172007815)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 5],
      geom: "POINT(1366790.4788778685 6197535.100126101)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 6],
      geom: "POINT(1366751.2524381902 6197414.725945642)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 7],
      geom: "POINT(1366739.296976532 6197416.256047683)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 8],
      geom: "POINT(1366703.3158513773 6197412.759818201)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 9],
      geom: "POINT(1366554.4765726707 6197504.394970648)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 10],
      geom: "POINT(1366538.1450679235 6197439.625388365)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 11],
      geom: "POINT(1366497.946022559 6197473.096855916)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 12],
      geom: "POINT(1366395.5515403417 6197499.567978062)",
    },
    {
      featid: "505a0064-a8ff-455e-a269-8e4d11ea1b15",
      path: [2, 1, 13],
      geom: "POINT(1366399.6288706062 6197575.292528696)",
    },
  ];
  const expected = {
    points: [
      [1366395.5515403417, 6197499.567978062],
      [1366395.504254352, 6197498.689782293],
      [1366324.6943056888, 6197517.886108183],
      [1366395.5515403417, 6197499.567978062],
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
    ppath: [
      [1, 1, 1],
      [1, 1, 2],
      [1, 1, 3],
      [1, 1, 4],
      [2, 1, 1],
      [2, 1, 2],
      [2, 1, 3],
      [2, 1, 4],
      [2, 1, 5],
      [2, 1, 6],
      [2, 1, 7],
      [2, 1, 8],
      [2, 1, 9],
      [2, 1, 10],
      [2, 1, 11],
      [2, 1, 12],
      [2, 1, 13],
    ],
  };
  const result = parsePolyPoints(poly);
  // TODO alternative to deepEqual? Works but is deprecated
  t.deepEqual(result, expected, "parsePolyPoints");

  t.end();
});
/*
test("findWrappingMVT", (t) => {
  const result = findWrappingMVT(-13611638.36, 4544607.03, 12);
  console.log("WRappingMvtRes", result);
  t.equal(
    result,
    [2314, 1494],
    "findWrappingMVT(-13611638.36, 4544607.03, 12)"
  );
  t.end();
});
*/
