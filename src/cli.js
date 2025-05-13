/**
 * Command-line interface for the Geo Tile Downloader
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config.js';
import { TileDownloader } from './downloader.js';
import { BoundingBoxCalculator } from './geo.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse command-line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsedArgs = {
    command: args[0],
    options: {}
  };

  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      parsedArgs.options[key] = value;
    }
  }

  return parsedArgs;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Geo Tile Downloader - A Node.js application to download geographic image tiles

Usage:
  node src/cli.js <command> [options]

Commands:
  download-bbox     Download tiles for a bounding box
  download-geojson  Download tiles for a GeoJSON file
  retry-failed      Retry failed downloads
  list-tilemaps     List available tile maps

Options:
  --tilemap         Tile map name (required for download commands)
  --bbox            Bounding box as "minLon,minLat,maxLon,maxLat" (required for download-bbox)
  --geojson         Path to GeoJSON file (required for download-geojson)
  --min-zoom        Minimum zoom level (default: 0)
  --max-zoom        Maximum zoom level (default: 18)
  --concurrency     Number of concurrent downloads (default: 5)

Features:
  - Progress bar showing download status
  - Statistics tracking (calculated, downloaded, skipped, failed tiles)
  - Automatic retry for failed downloads

Examples:
  node src/cli.js download-bbox --tilemap OSM_Map --bbox "-74.01,40.70,-73.96,40.75" --min-zoom 10 --max-zoom 15
  node src/cli.js download-geojson --tilemap OSM_Map --geojson ./area.geojson --min-zoom 10 --max-zoom 15
  node src/cli.js retry-failed
  node src/cli.js list-tilemaps
  `);
}

/**
 * Progress callback function for CLI
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
 * Print statistics
 * @param {Object} stats The statistics object
 */
function printStats(stats) {
  console.log('\nDownload Statistics:');
  console.log(`- Total Tiles: ${stats.totalTiles}`);
  console.log(`- Downloaded: ${stats.downloadedTiles}`);
  console.log(`- Skipped (Already Exist): ${stats.skippedTiles}`);
  console.log(`- Failed: ${stats.failedTiles}`);

  // Calculate success rate
  const attempted = stats.downloadedTiles + stats.failedTiles;
  const successRate = attempted > 0 ? Math.round((stats.downloadedTiles / attempted) * 100) : 100;
  console.log(`- Success Rate: ${successRate}%`);
}

/**
 * Run the CLI
 */
async function run() {
  try {
    const args = parseArgs();

    if (!args.command) {
      printUsage();
      return;
    }

    const config = loadConfig();
    const concurrency = args.options.concurrency ? parseInt(args.options.concurrency) : 5;
    const downloader = new TileDownloader(config, concurrency);

    // Set progress callback
    downloader.setProgressCallback(progressCallback);

    switch (args.command) {
      case 'download-bbox': {
        if (!args.options.tilemap) {
          console.error('Error: --tilemap option is required');
          return;
        }

        if (!args.options.bbox) {
          console.error('Error: --bbox option is required');
          return;
        }

        const tileMapName = args.options.tilemap;
        const bbox = args.options.bbox.split(',').map(Number);
        const minZoom = args.options['min-zoom'] ? parseInt(args.options['min-zoom']) : 0;
        const maxZoom = args.options['max-zoom'] ? parseInt(args.options['max-zoom']) : 18;

        console.log(`Downloading tiles for bounding box: ${bbox} (zoom ${minZoom}-${maxZoom})`);
        console.log('Press Ctrl+C to cancel\n');

        // Download tiles and get statistics
        const stats = await downloader.downloadTilesForBoundingBox(tileMapName, bbox, minZoom, maxZoom);

        // Print statistics
        printStats(stats);
        break;
      }

      case 'download-geojson': {
        if (!args.options.tilemap) {
          console.error('Error: --tilemap option is required');
          return;
        }

        if (!args.options.geojson) {
          console.error('Error: --geojson option is required');
          return;
        }

        const tileMapName = args.options.tilemap;
        const geojsonPath = path.resolve(process.cwd(), args.options.geojson);
        const geojson = JSON.parse(await fs.readFile(geojsonPath, 'utf8'));
        const minZoom = args.options['min-zoom'] ? parseInt(args.options['min-zoom']) : 0;
        const maxZoom = args.options['max-zoom'] ? parseInt(args.options['max-zoom']) : 18;

        console.log(`Downloading tiles for GeoJSON: ${geojsonPath} (zoom ${minZoom}-${maxZoom})`);
        console.log('Press Ctrl+C to cancel\n');

        // Download tiles and get statistics
        const stats = await downloader.downloadTilesForGeoJSON(tileMapName, geojson, minZoom, maxZoom);

        // Print statistics
        printStats(stats);
        break;
      }

      case 'retry-failed': {
        console.log('Retrying failed downloads...');
        console.log('Press Ctrl+C to cancel\n');

        // Retry failed downloads and get statistics
        const stats = await downloader.retryFailedDownloads();

        // Print statistics
        if (stats.totalTiles > 0) {
          console.log('\nRetry Statistics:');
          console.log(`- Total Retried: ${stats.totalTiles}`);
          console.log(`- Successfully Downloaded: ${stats.downloadedTiles}`);
          console.log(`- Skipped (Already Exist): ${stats.skippedTiles}`);
          console.log(`- Failed Again: ${stats.failedTiles}`);

          // Calculate retry success rate
          const successRate = Math.round((stats.downloadedTiles / stats.totalTiles) * 100);
          console.log(`- Retry Success Rate: ${successRate}%`);
        } else {
          console.log('No failed downloads to retry');
        }
        break;
      }

      case 'list-tilemaps': {
        console.log('Available tile maps:');
        for (const tileMap of config.TileMaps) {
          console.log(`- ${tileMap.Name}: ${tileMap.Url}`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${args.command}`);
        printUsage();
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the CLI if this file is executed directly
// In ESM, we can use import.meta.url to check if this file is the main module
// We need to handle different path formats on different operating systems
const isMainModule = () => {
  // Get the file path from import.meta.url
  const currentFileUrl = import.meta.url;
 //console.log(`currentFileUrl: ${currentFileUrl}`);
  // Get the file path from process.argv[1]
  const mainScriptPath = process.argv[1];

  // Check if the current file is in the main script path
  // This handles different path formats and normalizes them
  return mainScriptPath && (
    // Direct match
    currentFileUrl.includes(mainScriptPath) ||
    // Check for the filename
    currentFileUrl.endsWith('/src/cli.js') ||
    currentFileUrl.endsWith('\\src\\cli.js')
  );
};

// Run the CLI if this is the main module
if (isMainModule()) {
  run().catch(error => {
    console.error('Error in CLI:', error);
  });
}

export { run };
