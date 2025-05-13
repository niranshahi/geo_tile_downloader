/**
 * Tile downloader module for the Geo Tile Downloader
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import PQueue from 'p-queue';
import { getTileMapByName } from './config.js';
import { calculateTilesForBoundingBox, calculateTilesForGeoJSON } from './geo.js';

class TileDownloader {
  /**
   * Create a new TileDownloader
   * @param {Object} config The application configuration
   * @param {number} concurrency The number of concurrent downloads (default: 5)
   */
  constructor(config, concurrency = 5) {
    this.config = config;
    this.queue = new PQueue({ concurrency });
    this.failedDownloads = [];

    // Statistics tracking
    this.stats = {
      calculatedTiles: 0,
      downloadedTiles: 0,
      failedTiles: 0,
      skippedTiles: 0, // Already existing tiles
      inProgress: 0,
      totalTiles: 0
    };

    // Progress tracking
    this.progressCallback = null;
  }

  /**
   * Set a callback function for progress reporting
   * @param {Function} callback The callback function(stats, progressPercent)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      calculatedTiles: 0,
      downloadedTiles: 0,
      failedTiles: 0,
      skippedTiles: 0,
      inProgress: 0,
      totalTiles: 0
    };
    this.failedDownloads = [];
  }

  /**
   * Get current statistics
   * @returns {Object} The current statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Update progress and call the progress callback if set
   */
  updateProgress() {
    if (this.progressCallback) {
      const completed = this.stats.downloadedTiles + this.stats.failedTiles + this.stats.skippedTiles;
      const progressPercent = this.stats.totalTiles > 0
        ? Math.round((completed / this.stats.totalTiles) * 100)
        : 0;

      this.progressCallback(this.getStats(), progressPercent);
    }
  }

  /**
   * Generate a tile URL from a tile map configuration
   * @param {Object} tileMap The tile map configuration
   * @param {number} x The x coordinate
   * @param {number} y The y coordinate
   * @param {number} z The zoom level
   * @returns {string} The tile URL
   */
  generateTileUrl(tileMap, x, y, z) {
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
   * @param {string} tileMapName The name of the tile map
   * @param {number} x The x coordinate
   * @param {number} y The y coordinate
   * @param {number} z The zoom level
   * @param {string} format The image format
   * @returns {string} The file path
   */
  generateTilePath(tileMapName, x, y, z, format) {
    // Get the tile level path using the Microsoft VE tile algorithm
    const tileLevelPath = this.createTileLevelPath(z, x, y);

    // Generate the output tile name
    const tileFileName = this.getOutputTileName(tileMapName, z, x, y);

    // Combine the paths
    let filePath;
    if (tileLevelPath !== "") {
      filePath = path.join(
        this.config.TileCacheFolder,
        tileMapName,
        tileLevelPath,
        `${tileFileName}.${format}`
      );
    } else {
      filePath = path.join(
        this.config.TileCacheFolder,
        tileMapName,
        `${tileFileName}.${format}`
      );
    }

    return filePath;
  }

  /**
   * Create a tile level path based on the Microsoft VE tile algorithm
   * @param {number} level The zoom level
   * @param {number} xIndex The x coordinate
   * @param {number} yIndex The y coordinate
   * @returns {string} The tile level path
   */
  createTileLevelPath(level, xIndex, yIndex) {
    const tileLevelString = this.getMicrosoftVETile(level, xIndex, yIndex);
    if (tileLevelString === "_") {
      return "";
    }

    // Create a path with each character as a separate directory
    let result = "";
    for (let i = 0; i < tileLevelString.length; i++) {
      result = path.join(result, tileLevelString.substring(i, i + 1));
    }

    return result;
  }

  /**
   * Get the Microsoft VE tile string
   * @param {number} level The zoom level
   * @param {number} xIndex The x coordinate
   * @param {number} yIndex The y coordinate
   * @returns {string} The Microsoft VE tile string
   */
  getMicrosoftVETile(level, xIndex, yIndex) {
    if (level === 0) {
      return "_";
    }

    let builder = "";
    let xInd = xIndex;
    let yInd = yIndex;

    for (let i = 1; i <= level; i++) {
      let c = 0;
      if (xInd % 2 === 1) {
        c++;
      }
      if (yInd % 2 === 1) {
        c += 2;
      }

      xInd = Math.floor(xInd / 2);
      yInd = Math.floor(yInd / 2);

      // Insert at the beginning of the string
      builder = c.toString() + builder;
    }

    return builder;
  }

  /**
   * Get the output tile name
   * @param {string} namePrefix The name prefix (tile map name)
   * @param {number} level The zoom level
   * @param {number} i The x coordinate
   * @param {number} j The y coordinate
   * @returns {string} The output tile name
   */
  getOutputTileName(namePrefix, level, i, j) {
    let fileName = namePrefix;

    // Add level with padding
    fileName += "_";
    if (level < 100 && level >= 0) {
      if (level < 10) {
        fileName += "0" + level.toString();
      } else {
        fileName += level.toString();
      }
    } else if (level >= 100) {
      fileName += "99";
    } else if (level < 0) {
      fileName += "00";
    }

    // Add x coordinate with padding
    fileName += "_";
    if (i < 100000000 && i >= 0) {
      const tmp = i.toString();
      const padding = "0".repeat(8 - tmp.length);
      fileName += padding + tmp;
    } else if (i >= 100000000) {
      fileName += "99999999";
    } else if (i < 0) {
      fileName += "00000000";
    }

    // Add y coordinate with padding
    fileName += "_";
    if (j < 100000000 && j >= 0) {
      const tmp = j.toString();
      const padding = "0".repeat(8 - tmp.length);
      fileName += padding + tmp;
    } else if (j >= 100000000) {
      fileName += "99999999";
    } else if (j < 0) {
      fileName += "00000000";
    }

    return fileName;
  }

  /**
   * Download a single tile
   * @param {string} tileMapName The name of the tile map
   * @param {number} x The x coordinate
   * @param {number} y The y coordinate
   * @param {number} z The zoom level
   * @returns {Promise<boolean>} Whether the download was successful
   */
  async downloadTile(tileMapName, x, y, z) {
    const tileMap = getTileMapByName(this.config, tileMapName);
    const url = this.generateTileUrl(tileMap, x, y, z);
    const filePath = this.generateTilePath(tileMapName, x, y, z, tileMap.Format);

    // Increment in-progress counter
    this.stats.inProgress++;

    try {
      // Check if the tile already exists
      if (await fs.pathExists(filePath)) {
        console.log(`Tile already exists: ${filePath}`);

        // Update statistics
        this.stats.skippedTiles++;
        this.stats.inProgress--;
        this.updateProgress();

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

      // Update statistics
      this.stats.downloadedTiles++;
      this.stats.inProgress--;
      this.updateProgress();

      return true;
    } catch (error) {
      console.error(`Failed to download tile (${tileMapName}, ${z}/${x}/${y}): ${error.message}`);

      // Update statistics
      this.stats.failedTiles++;
      this.stats.inProgress--;
      this.failedDownloads.push({ tileMapName, x, y, z });
      this.updateProgress();

      return false;
    }
  }

  /**
   * Download tiles for a bounding box
   * @param {string} tileMapName The name of the tile map
   * @param {Array<number>} boundingBox [minLon, minLat, maxLon, maxLat]
   * @param {number} minZoom The minimum zoom level
   * @param {number} maxZoom The maximum zoom level
   * @returns {Promise<Object>} Statistics about the download operation
   */
  async downloadTilesForBoundingBox(tileMapName, boundingBox, minZoom, maxZoom) {
    console.log(`Downloading tiles for bounding box: ${boundingBox} (zoom ${minZoom}-${maxZoom})`);

    // Reset statistics for this operation
    this.resetStats();

    // Calculate tiles for the bounding box
    const tiles = calculateTilesForBoundingBox(boundingBox, minZoom, maxZoom);

    // Update statistics
    this.stats.calculatedTiles = tiles.length;
    this.stats.totalTiles = tiles.length;
    console.log(`Total tiles to download: ${tiles.length}`);

    // Initial progress update
    this.updateProgress();

    // Add all tiles to the download queue
    for (const tile of tiles) {
      this.queue.add(() => this.downloadTile(tileMapName, tile.x, tile.y, tile.z));
    }

    // Wait for all downloads to complete
    await this.queue.onIdle();

    // Final progress update
    this.updateProgress();

    // Report on download statistics
    console.log(`
Download Statistics:
- Total Tiles: ${this.stats.totalTiles}
- Downloaded: ${this.stats.downloadedTiles}
- Skipped (Already Exist): ${this.stats.skippedTiles}
- Failed: ${this.stats.failedTiles}
- Success Rate: ${Math.round((this.stats.downloadedTiles / (this.stats.downloadedTiles + this.stats.failedTiles)) * 100)}%
    `);

    // Return the statistics
    return this.getStats();
  }

  /**
   * Download tiles for a GeoJSON feature
   * @param {string} tileMapName The name of the tile map
   * @param {Object} geojson The GeoJSON object
   * @param {number} minZoom The minimum zoom level
   * @param {number} maxZoom The maximum zoom level
   * @returns {Promise<Object>} Statistics about the download operation
   */
  async downloadTilesForGeoJSON(tileMapName, geojson, minZoom, maxZoom) {
    console.log(`Downloading tiles for GeoJSON (zoom ${minZoom}-${maxZoom})`);

    // Reset statistics for this operation
    this.resetStats();

    // Calculate tiles for the GeoJSON
    console.log('Calculating tiles for GeoJSON...');
    console.log('This may take some time for complex GeoJSON or high zoom levels.');

    const tiles = calculateTilesForGeoJSON(geojson, minZoom, maxZoom);

    // Update statistics
    this.stats.calculatedTiles = tiles.length;
    this.stats.totalTiles = tiles.length;
    console.log(`\nTotal tiles to download: ${tiles.length}`);

    // Initial progress update
    this.updateProgress();

    // Add all tiles to the download queue
    for (const tile of tiles) {
      this.queue.add(() => this.downloadTile(tileMapName, tile.x, tile.y, tile.z));
    }

    // Wait for all downloads to complete
    await this.queue.onIdle();

    // Final progress update
    this.updateProgress();

    // Report on download statistics
    console.log(`
Download Statistics:
- Total Tiles: ${this.stats.totalTiles}
- Downloaded: ${this.stats.downloadedTiles}
- Skipped (Already Exist): ${this.stats.skippedTiles}
- Failed: ${this.stats.failedTiles}
- Success Rate: ${Math.round((this.stats.downloadedTiles / (this.stats.downloadedTiles + this.stats.failedTiles)) * 100)}%
    `);

    // Return the statistics
    return this.getStats();
  }

  /**
   * Retry failed downloads
   * @returns {Promise<Object>} Statistics about the retry operation
   */
  async retryFailedDownloads() {
    if (this.failedDownloads.length === 0) {
      console.log('No failed downloads to retry');
      return this.getStats();
    }

    // We're starting a new operation, so we'll reset the statistics

    // Reset statistics for this operation
    this.resetStats();

    console.log(`Retrying ${this.failedDownloads.length} failed downloads`);
    const failedDownloads = [...this.failedDownloads];
    this.failedDownloads = [];

    // Update statistics
    this.stats.calculatedTiles = failedDownloads.length;
    this.stats.totalTiles = failedDownloads.length;

    // Initial progress update
    this.updateProgress();

    // Add all failed downloads to the queue
    for (const tile of failedDownloads) {
      this.queue.add(() => this.downloadTile(tile.tileMapName, tile.x, tile.y, tile.z));
    }

    // Wait for all downloads to complete
    await this.queue.onIdle();

    // Final progress update
    this.updateProgress();

    // Report on retry statistics
    console.log(`
Retry Statistics:
- Total Retried: ${this.stats.totalTiles}
- Successfully Downloaded: ${this.stats.downloadedTiles}
- Skipped (Already Exist): ${this.stats.skippedTiles}
- Failed Again: ${this.stats.failedTiles}
- Success Rate: ${Math.round((this.stats.downloadedTiles / this.stats.totalTiles) * 100)}%
    `);

    // Return the statistics
    return this.getStats();
  }
}

export { TileDownloader };
