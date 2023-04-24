/**
 * Recursively crop floating point numbers in a JSON object's "geometry" values to 9 decimal places, rounding up.
 * @param obj The JSON object to process
 * @returns The processed JSON object
 */
export function cropGeometryCoordinates(obj: any): any {
  if ("coordinates" in obj) {
    const geometry = obj["coordinates"];
    cropCoordinates(geometry);

    return obj;
  }
}

function cropCoordinates(coordinates: any): void {
  if (Array.isArray(coordinates)) {
    for (let i = 0; i < coordinates.length; i++) {
      const coordinate = coordinates[i];
      if (typeof coordinate === "number") {
        coordinates[i] = Math.round(coordinate * 1e9) / 1e9;
      } else if (Array.isArray(coordinate)) {
        cropCoordinates(coordinate);
      }
    }
  }
}
