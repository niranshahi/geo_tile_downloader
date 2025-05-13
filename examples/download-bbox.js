/**
 * Example: Download tiles for a bounding box
 */

import { loadConfig, TileDownloader } from '../index.js';

async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Initialize the tile downloader with 10 concurrent downloads
    const downloader = new TileDownloader(config, 10);

    // Define a bounding box for New York City
    const boundingBox = [-74.01, 40.70, -73.96, 40.75]; // Part of NYC
    const minZoom = 10;
    const maxZoom = 15;

    // Download tiles for the bounding box
    await downloader.downloadTilesForBoundingBox('OSM_Map', boundingBox, minZoom, maxZoom);

    // Retry any failed downloads
    await downloader.retryFailedDownloads();

    console.log('Download completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
