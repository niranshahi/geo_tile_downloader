# Geo Tile Downloader

A Node.js application to download geographic image tiles from various tile servers. This application allows you to download tiles for a specific bounding box or GeoJSON features, with support for different zoom levels, organized file structure, download queue, and retry mechanism for failed downloads.

## Features

- Download tiles from various tile servers (OpenStreetMap, Google Maps, etc.)
- Filter tiles by bounding box or GeoJSON features
- Manage zoom levels for tile downloads
- Organized file structure for storing tiles
- Concurrent download queue with configurable concurrency
- Retry mechanism for failed downloads
- Statistics tracking (calculated tiles, downloaded, skipped, failed)
- Progress reporting with customizable callback

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd geo-tile-downloader
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Note on ES Modules

This project uses ES Modules (ESM) instead of CommonJS. This means:

- Import statements use the `import` keyword instead of `require()`
- Export statements use the `export` keyword instead of `module.exports`
- File extensions (`.js`) are required in import statements
- To access `__dirname` and `__filename`, you need to use the `fileURLToPath` function from the `url` module

## Configuration

The application uses a `config.json` file to define tile servers and other settings. The file should have the following structure:

```json
{
  "TileCacheFolder": "path/to/tile/cache",
  "TileMaps": [
    {
      "Name": "OSM_Map",
      "Url": "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "Subdomains": "a,b,c",
      "Format": "png"
    },
    {
      "Name": "Google_Satellite",
      "Url": "http://{s}.google.com/vt/lyrs=s&hl=fa&x={x}&y={y}&z={z}",
      "Subdomains": "mt0,mt1,mt2,mt3",
      "Format": "png"
    }
  ]
}
```

- `TileCacheFolder`: The folder where downloaded tiles will be stored. If not specified, a `tile_cache` folder will be created in the current directory.
- `TileMaps`: An array of tile map configurations:
  - `Name`: A unique name for the tile map
  - `Url`: The URL template for the tile server, with placeholders for `{x}`, `{y}`, `{z}`, and `{s}` (subdomain)
  - `Subdomains`: A comma-separated list of subdomains to use for load balancing
  - `Format`: The image format of the tiles (e.g., "png", "jpg")

## Usage

### Command-Line Interface

The application provides a command-line interface for downloading tiles:

```
node src/cli.js <command> [options]
```

Commands:
- `download-bbox`: Download tiles for a bounding box
- `download-geojson`: Download tiles for a GeoJSON file
- `retry-failed`: Retry failed downloads
- `list-tilemaps`: List available tile maps

Options:
- `--tilemap`: Tile map name (required for download commands)
- `--bbox`: Bounding box as "minLon,minLat,maxLon,maxLat" (required for download-bbox)
- `--geojson`: Path to GeoJSON file (required for download-geojson)
- `--min-zoom`: Minimum zoom level (default: 0)
- `--max-zoom`: Maximum zoom level (default: 18)
- `--concurrency`: Number of concurrent downloads (default: 5)

Examples:
```
node src/cli.js download-bbox --tilemap OSM_Map --bbox "-74.01,40.70,-73.96,40.75" --min-zoom 10 --max-zoom 15
node src/cli.js download-geojson --tilemap OSM_Map --geojson ./area.geojson --min-zoom 10 --max-zoom 15
node src/cli.js retry-failed
node src/cli.js list-tilemaps
```

### Programmatic Usage

You can also use the application programmatically in your Node.js code:

```javascript
import { loadConfig, TileDownloader } from './index.js';

async function main() {
  // Load configuration
  const config = loadConfig();

  // Initialize the tile downloader
  const downloader = new TileDownloader(config);

  // Download tiles for a bounding box
  const boundingBox = [-74.01, 40.70, -73.96, 40.75]; // [minLon, minLat, maxLon, maxLat]
  const minZoom = 10;
  const maxZoom = 15;
  await downloader.downloadTilesForBoundingBox('OSM_Map', boundingBox, minZoom, maxZoom);

  // Retry failed downloads
  await downloader.retryFailedDownloads();
}

main();
```

### Statistics and Progress Tracking

The application provides statistics tracking and progress reporting:

```javascript
import { loadConfig, TileDownloader } from './index.js';

// Progress callback function
function progressCallback(stats, progressPercent) {
  console.log(`Progress: ${progressPercent}% | Downloaded: ${stats.downloadedTiles} | Total: ${stats.totalTiles}`);
}

async function main() {
  // Load configuration
  const config = loadConfig();

  // Initialize the tile downloader
  const downloader = new TileDownloader(config);

  // Set the progress callback
  downloader.setProgressCallback(progressCallback);

  // Download tiles for a bounding box
  const boundingBox = [-74.01, 40.70, -73.96, 40.75];
  const minZoom = 10;
  const maxZoom = 15;

  // The download methods return statistics
  const stats = await downloader.downloadTilesForBoundingBox('OSM_Map', boundingBox, minZoom, maxZoom);

  console.log('Final Statistics:');
  console.log(`- Total Tiles: ${stats.totalTiles}`);
  console.log(`- Downloaded: ${stats.downloadedTiles}`);
  console.log(`- Skipped (Already Exist): ${stats.skippedTiles}`);
  console.log(`- Failed: ${stats.failedTiles}`);
}

main();
```

See the `examples` folder for more usage examples, including `download-with-progress.js` for a complete example with a progress bar.

## File Structure

The downloaded tiles are stored in the following structure:

```
{TileCacheFolder}/{TileMapName}/{z}/{x}/{y}.{format}
```

For example:
```
tile_cache/OSM_Map/12/1234/5678.png
```

## License

[MIT](LICENSE)
