/**
 * Example: Download tiles for a GeoJSON file with progress tracking
 */

import { loadConfig, TileDownloader } from '../index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Progress callback function
 * @param {Object} stats The current statistics
 * @param {number} progressPercent The progress percentage
 */
function progressCallback(stats, progressPercent) {
  // Clear the current line
  process.stdout.write('\r\x1b[K');
  
  // Print progress bar
  const barLength = 30;
  const filledLength = Math.round(barLength * progressPercent / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  // Print progress information
  process.stdout.write(
    `Progress: [${bar}] ${progressPercent}% | ` +
    `Downloaded: ${stats.downloadedTiles} | ` +
    `Skipped: ${stats.skippedTiles} | ` +
    `Failed: ${stats.failedTiles} | ` +
    `In Progress: ${stats.inProgress} | ` +
    `Total: ${stats.totalTiles}`
  );
}

/**
 * Create a sample GeoJSON file if it doesn't exist
 * @returns {Promise<string>} The path to the GeoJSON file
 */
async function ensureGeoJsonFile() {
  const geojsonPath = path.resolve(__dirname, 'area.geojson');
  
  // Check if the GeoJSON file exists
  if (!await fs.pathExists(geojsonPath)) {
    // Create a simple GeoJSON polygon if the file doesn't exist
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'Sample Area'
          },
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
  
  return geojsonPath;
}

async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize the tile downloader with 5 concurrent downloads
    const downloader = new TileDownloader(config, 5);
    
    // Set the progress callback
    downloader.setProgressCallback(progressCallback);
    
    // Ensure we have a GeoJSON file
    const geojsonPath = await ensureGeoJsonFile();
    
    // Load the GeoJSON file
    const geojson = await fs.readJson(geojsonPath);
    
    // Set zoom levels
    const minZoom = 0;
    const maxZoom = 12; // Using a smaller max zoom for the example
    
    console.log(`Starting download for GeoJSON: ${geojsonPath} (zoom ${minZoom}-${maxZoom})`);
    console.log('Press Ctrl+C to cancel\n');
    
    // Download tiles for the GeoJSON
    const stats = await downloader.downloadTilesForGeoJSON('OSM_Map', geojson, minZoom, maxZoom);
    
    // Print a new line after the progress bar
    console.log('\n');
    
    // Print final statistics
    console.log('Final Statistics:');
    console.log(`- Total Tiles: ${stats.totalTiles}`);
    console.log(`- Downloaded: ${stats.downloadedTiles}`);
    console.log(`- Skipped (Already Exist): ${stats.skippedTiles}`);
    console.log(`- Failed: ${stats.failedTiles}`);
    
    // Calculate success rate
    const attempted = stats.downloadedTiles + stats.failedTiles;
    const successRate = attempted > 0 ? Math.round((stats.downloadedTiles / attempted) * 100) : 100;
    console.log(`- Success Rate: ${successRate}%`);
    
    // Retry failed downloads if any
    if (stats.failedTiles > 0) {
      console.log('\nRetrying failed downloads...');
      
      // Retry failed downloads
      const retryStats = await downloader.retryFailedDownloads();
      
      // Print a new line after the progress bar
      console.log('\n');
      
      // Print retry statistics
      console.log('Retry Statistics:');
      console.log(`- Total Retried: ${retryStats.totalTiles}`);
      console.log(`- Successfully Downloaded: ${retryStats.downloadedTiles}`);
      console.log(`- Skipped (Already Exist): ${retryStats.skippedTiles}`);
      console.log(`- Failed Again: ${retryStats.failedTiles}`);
      
      // Calculate retry success rate
      const retrySuccessRate = retryStats.totalTiles > 0 
        ? Math.round((retryStats.downloadedTiles / retryStats.totalTiles) * 100) 
        : 100;
      console.log(`- Retry Success Rate: ${retrySuccessRate}%`);
    }
    
    console.log('\nDownload completed');
  } catch (error) {
    console.error('\nError:', error.message);
  }
}

main();
