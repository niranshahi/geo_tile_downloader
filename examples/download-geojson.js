/**
 * Example: Download tiles for a GeoJSON file
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, TileDownloader } from '../index.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Initialize the tile downloader with 10 concurrent downloads
    const downloader = new TileDownloader(config, 10);

    // Load a GeoJSON file
    // Note: You need to create or provide a GeoJSON file
    const geojsonPath = path.resolve(__dirname, 'area.geojson');

    // Check if the GeoJSON file exists
    if (!await fs.pathExists(geojsonPath)) {
      // Create a simple GeoJSON polygon if the file doesn't exist
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-74.01, 40.70],
                  [-74.01, 40.75],
                  [-73.96, 40.75],
                  [-73.96, 40.70],
                  [-74.01, 40.70]
                ]
              ]
            }
          }
        ]
      };

      await fs.writeJson(geojsonPath, geojson, { spaces: 2 });
      console.log(`Created example GeoJSON file: ${geojsonPath}`);
    }

    // Load the GeoJSON file
    const geojson = await fs.readJson(geojsonPath);

    // Set zoom levels
    const minZoom = 10;
    const maxZoom = 15;

    // Download tiles for the GeoJSON
    await downloader.downloadTilesForGeoJSON('OSM_Map', geojson, minZoom, maxZoom);

    // Retry any failed downloads
    await downloader.retryFailedDownloads();

    console.log('Download completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
