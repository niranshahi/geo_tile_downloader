/**
 * Geographic utilities for the Geo Tile Downloader
 */

import * as turf from '@turf/turf';

/**
 * Convert latitude and longitude to tile coordinates
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {number} zoom Zoom level
 * @returns {Object} Tile coordinates {x, y}
 */
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Convert tile coordinates to bounding box
 * @param {number} x Tile x coordinate
 * @param {number} y Tile y coordinate
 * @param {number} zoom Zoom level
 * @returns {Array<number>} Bounding box [minLon, minLat, maxLon, maxLat]
 */
function tileToLatLonBounds(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const west = x / n * 360 - 180;
  const east = (x + 1) / n * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  return [west, south, east, north];
}

/**
 * Calculate tiles that cover a bounding box
 * @param {Array<number>} boundingBox [minLon, minLat, maxLon, maxLat]
 * @param {number} minZoom Minimum zoom level
 * @param {number} maxZoom Maximum zoom level
 * @returns {Array<Object>} Array of tile objects {x, y, z}
 */
function calculateTilesForBoundingBox(boundingBox, minZoom, maxZoom) {
  const [minLon, minLat, maxLon, maxLat] = boundingBox;
  const tiles = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    // Get tile coordinates for the corners of the bounding box
    const topLeft = latLonToTile(maxLat, minLon, z);
    const bottomRight = latLonToTile(minLat, maxLon, z);

    // Iterate over all tiles in the bounding box
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

/**
 * Check if a tile intersects with a GeoJSON feature
 * @param {number} x Tile x coordinate
 * @param {number} y Tile y coordinate
 * @param {number} zoom Zoom level
 * @param {Object} feature GeoJSON feature
 * @returns {boolean} Whether the tile intersects with the feature
 */
function tileIntersectsFeature(x, y, zoom, feature) {
  // Convert tile to bounding box
  const [west, south, east, north] = tileToLatLonBounds(x, y, zoom);

  // Create a polygon for the tile
  const tilePolygon = turf.polygon([[
    [west, north],
    [east, north],
    [east, south],
    [west, south],
    [west, north]
  ]]);

  // Check if the tile intersects with the feature
  return turf.booleanIntersects(tilePolygon, feature);
}

/**
 * Calculate tiles that cover a GeoJSON object
 * @param {Object} geojson GeoJSON object
 * @param {number} minZoom Minimum zoom level
 * @param {number} maxZoom Maximum zoom level
 * @returns {Array<Object>} Array of tile objects {x, y, z}
 */
function calculateTilesForGeoJSON(geojson, minZoom, maxZoom) {
  // Convert GeoJSON to features array
  let features = [];
  if (geojson.type === 'FeatureCollection') {
    features = geojson.features;
  } else if (geojson.type === 'Feature') {
    features = [geojson];
  } else {
    // Convert geometry to feature
    features = [turf.feature(geojson)];
  }

  // Use a Set to store unique tile keys
  const tileSet = new Set();
  // Store the actual tile objects
  const tileMap = new Map();

  // Calculate total number of features for progress reporting
  const totalFeatures = features.length;
  const totalZoomLevels = maxZoom - minZoom + 1;

  // Process each zoom level separately, starting from the lowest zoom
  for (let z = minZoom; z <= maxZoom; z++) {
    console.log(`Processing zoom level ${z}/${maxZoom} (${Math.round((z - minZoom + 1) / totalZoomLevels * 100)}% complete)...`);

    // Process each feature separately
    for (let featureIndex = 0; featureIndex < features.length; featureIndex++) {
      const feature = features[featureIndex];
      const featureName = feature.properties?.name || `Feature ${featureIndex + 1}`;

      // Get the bounding box of the feature
      const featureBbox = turf.bbox(feature);

      // Calculate the tile range for this feature at this zoom level
      const topLeft = latLonToTile(featureBbox[3], featureBbox[0], z);
      const bottomRight = latLonToTile(featureBbox[1], featureBbox[2], z);

      // Count potential tiles for this feature
      const potentialTileCount = (bottomRight.x - topLeft.x + 1) * (bottomRight.y - topLeft.y + 1);

      // If there are too many potential tiles, skip detailed intersection check
      // and just use the bounding box tiles for very large areas
      const skipIntersectionCheck = potentialTileCount > 10000;

      console.log(`  Processing feature ${featureIndex + 1}/${totalFeatures}: ${featureName} (${potentialTileCount} potential tiles)`);

      if (skipIntersectionCheck) {
        console.log(`  Feature ${featureIndex + 1} has too many potential tiles (${potentialTileCount}), using bounding box approximation`);
      }

      // Iterate over all tiles in the feature's bounding box
      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          // Create a unique key for this tile
          const tileKey = `${z}/${x}/${y}`;

          // Skip if we've already processed this tile
          if (tileSet.has(tileKey)) {
            continue;
          }

          // Check if the tile intersects with the feature
          // Skip the detailed check for very large areas
          if (skipIntersectionCheck || tileIntersectsFeature(x, y, z, feature)) {
            // Add the tile to our set and map
            tileSet.add(tileKey);
            tileMap.set(tileKey, { x, y, z });
          }
        }
      }
    }
  }

  // Convert the map values to an array
  const tiles = Array.from(tileMap.values());

  // Print summary
  console.log(`\nTile calculation complete:`);
  console.log(`- Total features processed: ${features.length}`);
  console.log(`- Zoom levels: ${minZoom} to ${maxZoom}`);
  console.log(`- Total unique tiles: ${tiles.length}`);

  return tiles;
}

/**
 * Calculate the bounding box for a GeoJSON object
 * @param {Object} geojson GeoJSON object
 * @returns {Array<number>} Bounding box [minLon, minLat, maxLon, maxLat]
 */
function calculateBoundingBox(geojson) {
  return turf.bbox(geojson);
}

class BoundingBoxCalculator {
  /**
   * Calculate tiles for a bounding box
   * @param {Array<number>} boundingBox [minLon, minLat, maxLon, maxLat]
   * @param {number} minZoom Minimum zoom level
   * @param {number} maxZoom Maximum zoom level
   * @returns {Array<Object>} Array of tile objects {x, y, z}
   */
  static calculateTilesForBoundingBox(boundingBox, minZoom, maxZoom) {
    return calculateTilesForBoundingBox(boundingBox, minZoom, maxZoom);
  }

  /**
   * Calculate tiles for a GeoJSON object
   * @param {Object} geojson GeoJSON object
   * @param {number} minZoom Minimum zoom level
   * @param {number} maxZoom Maximum zoom level
   * @returns {Array<Object>} Array of tile objects {x, y, z}
   */
  static calculateTilesForGeoJSON(geojson, minZoom, maxZoom) {
    return calculateTilesForGeoJSON(geojson, minZoom, maxZoom);
  }

  /**
   * Calculate the bounding box for a GeoJSON object
   * @param {Object} geojson GeoJSON object
   * @returns {Array<number>} Bounding box [minLon, minLat, maxLon, maxLat]
   */
  static calculateBoundingBox(geojson) {
    return calculateBoundingBox(geojson);
  }
}

export {
  latLonToTile,
  tileToLatLonBounds,
  calculateTilesForBoundingBox,
  calculateTilesForGeoJSON,
  calculateBoundingBox,
  BoundingBoxCalculator
};
