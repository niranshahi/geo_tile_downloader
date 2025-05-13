/**
 * Example: Download tiles for a complex GeoJSON file with multiple features
 */

import { loadConfig, TileDownloader } from '../index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Progress callback function with feature information
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
    `Total: ${stats.totalTiles}`
  );
}

/**
 * Process each feature in the GeoJSON file separately
 * @param {Object} geojson The GeoJSON object
 * @param {TileDownloader} downloader The tile downloader
 * @param {string} tileMapName The tile map name
 * @param {number} minZoom The minimum zoom level
 * @param {number} maxZoom The maximum zoom level
 */
async function processFeatures(geojson, downloader, tileMapName, minZoom, maxZoom) {
  const features = geojson.features;
  const totalFeatures = features.length;
  let totalStats = {
    calculatedTiles: 0,
    downloadedTiles: 0,
    skippedTiles: 0,
    failedTiles: 0,
    totalTiles: 0
  };
  
  console.log(`Processing ${totalFeatures} features from GeoJSON file`);
  
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const featureName = feature.properties?.name || `Feature ${i + 1}`;
    const featureType = feature.geometry.type;
    
    console.log(`\nProcessing feature ${i + 1}/${totalFeatures}: ${featureName} (${featureType})`);
    
    // Create a GeoJSON object with just this feature
    const featureGeoJson = {
      type: 'FeatureCollection',
      features: [feature]
    };
    
    // Download tiles for this feature
    const stats = await downloader.downloadTilesForGeoJSON(tileMapName, featureGeoJson, minZoom, maxZoom);
    
    // Print a new line after the progress bar
    console.log('\n');
    
    // Print feature statistics
    console.log(`Statistics for ${featureName}:`);
    console.log(`- Total Tiles: ${stats.totalTiles}`);
    console.log(`- Downloaded: ${stats.downloadedTiles}`);
    console.log(`- Skipped: ${stats.skippedTiles}`);
    console.log(`- Failed: ${stats.failedTiles}`);
    
    // Update total statistics
    totalStats.calculatedTiles += stats.calculatedTiles;
    totalStats.downloadedTiles += stats.downloadedTiles;
    totalStats.skippedTiles += stats.skippedTiles;
    totalStats.failedTiles += stats.failedTiles;
    totalStats.totalTiles += stats.totalTiles;
  }
  
  return totalStats;
}

async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize the tile downloader with 5 concurrent downloads
    const downloader = new TileDownloader(config, 5);
    
    // Set the progress callback
    downloader.setProgressCallback(progressCallback);
    
    // Path to the complex GeoJSON file
    const geojsonPath = path.resolve(__dirname, 'complex-area.geojson');
    
    // Check if the file exists
    if (!await fs.pathExists(geojsonPath)) {
      console.error(`GeoJSON file not found: ${geojsonPath}`);
      console.error('Please run the example with the provided complex-area.geojson file');
      return;
    }
    
    // Load the GeoJSON file
    const geojson = await fs.readJson(geojsonPath);
    
    // Set zoom levels
    const minZoom = 10;
    const maxZoom = 12; // Using a smaller max zoom for the example
    
    console.log(`Starting download for complex GeoJSON: ${geojsonPath} (zoom ${minZoom}-${maxZoom})`);
    console.log('Press Ctrl+C to cancel\n');
    
    // Process each feature separately
    const totalStats = await processFeatures(geojson, downloader, 'OSM_Map', minZoom, maxZoom);
    
    // Print total statistics
    console.log('\nTotal Statistics:');
    console.log(`- Total Tiles: ${totalStats.totalTiles}`);
    console.log(`- Downloaded: ${totalStats.downloadedTiles}`);
    console.log(`- Skipped: ${totalStats.skippedTiles}`);
    console.log(`- Failed: ${totalStats.failedTiles}`);
    
    // Calculate success rate
    const attempted = totalStats.downloadedTiles + totalStats.failedTiles;
    const successRate = attempted > 0 ? Math.round((totalStats.downloadedTiles / attempted) * 100) : 100;
    console.log(`- Success Rate: ${successRate}%`);
    
    // Retry failed downloads if any
    if (totalStats.failedTiles > 0) {
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
