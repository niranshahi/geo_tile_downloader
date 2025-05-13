/**
 * Example usage of the Geo Tile Downloader
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import PQueue from 'p-queue';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.resolve(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Set default tile cache folder if not specified
if (!config.TileCacheFolder || config.TileCacheFolder.trim() === '') {
  config.TileCacheFolder = path.resolve(__dirname, 'tile_cache');
}

// Ensure the tile cache folder exists
fs.ensureDirSync(config.TileCacheFolder);

/**
 * Generate a tile URL from a tile map configuration
 */
function generateTileUrl(tileMap, x, y, z) {
  let url = tileMap.Url;

  // Replace placeholders in URL
  url = url.replace('{x}', x);
  url = url.replace('{y}', y);
  url = url.replace('{z}', z);

  // Handle subdomains if present
  if (tileMap.Subdomains && url.includes('{s}')) {
    const subdomains = tileMap.Subdomains.split(',');
    const subdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
    url = url.replace('{s}', subdomain);
  }

  return url;
}

/**
 * Generate the file path for a tile
 */
function generateTilePath(tileMapName, x, y, z, format) {
  return path.join(
    config.TileCacheFolder,
    tileMapName,
    z.toString(),
    x.toString(),
    `${y}.${format}`
  );
}

/**
 * Download a single tile
 */
async function downloadTile(tileMapName, x, y, z) {
  const tileMap = config.TileMaps.find(tm => tm.Name === tileMapName);
  if (!tileMap) {
    throw new Error(`Tile map "${tileMapName}" not found in configuration`);
  }

  const url = generateTileUrl(tileMap, x, y, z);
  const filePath = generateTilePath(tileMapName, x, y, z, tileMap.Format);

  try {
    // Check if the tile already exists
    if (await fs.pathExists(filePath)) {
      console.log(`Tile already exists: ${filePath}`);
      return true;
    }

    // Ensure the directory exists
    await fs.ensureDir(path.dirname(filePath));

    // Download the tile
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000 // 30 seconds timeout
    });

    // Save the tile
    await fs.writeFile(filePath, response.data);
    console.log(`Downloaded tile: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Failed to download tile (${tileMapName}, ${z}/${x}/${y}): ${error.message}`);
    return false;
  }
}

/**
 * Convert latitude and longitude to tile coordinates
 */
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Calculate tiles for a bounding box
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
 * Download tiles for a bounding box
 */
async function downloadTilesForBoundingBox(tileMapName, boundingBox, minZoom, maxZoom, concurrency = 5) {
  console.log(`Downloading tiles for bounding box: ${boundingBox} (zoom ${minZoom}-${maxZoom})`);

  // Calculate tiles for the bounding box
  const tiles = calculateTilesForBoundingBox(boundingBox, minZoom, maxZoom);
  console.log(`Total tiles to download: ${tiles.length}`);

  // Create a download queue
  const queue = new PQueue({ concurrency });
  const failedDownloads = [];

  // Add all tiles to the download queue
  for (const tile of tiles) {
    queue.add(async () => {
      const success = await downloadTile(tileMapName, tile.x, tile.y, tile.z);
      if (!success) {
        failedDownloads.push(tile);
      }
    });
  }

  // Wait for all downloads to complete
  await queue.onIdle();

  // Report on failed downloads
  if (failedDownloads.length > 0) {
    console.log(`Failed to download ${failedDownloads.length} tiles`);
  } else {
    console.log('All tiles downloaded successfully');
  }

  return failedDownloads;
}

// Example usage
async function main() {
  try {
    // Define a bounding box for a small area (part of New York City)
    const boundingBox = [-74.01, 40.70, -73.96, 40.75];
    const minZoom = 10;
    const maxZoom = 12; // Using a smaller max zoom for the example

    // Download tiles for the bounding box
    const failedDownloads = await downloadTilesForBoundingBox('OSM_Map', boundingBox, minZoom, maxZoom, 3);

    console.log('Download completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();
