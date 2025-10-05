const fs = require("fs");
const path = require("path");
const {
  ensureDirectoryExists,
  resolveAbsolutePath,
} = require("./utils/pathResolver");
const logger = require("./utils/logger");
const browserManager = require("./browserManager");
const config = require("./config");

class ScreenshotService {
  constructor() {
    this.screenshots = new Map();
  }

  async capturePageScreenshot(url, options = {}) {
    const {
      viewport = {},
      fullPage = true,
      selector,
      waitForSelector,
      waitForTimeout = 2000,
      format = config.getScreenshotConfig().format,
      quality = 80,
      fileName = options.filename ||
        options.fileName ||
        `screenshot-${Date.now()}.${format}`,
      path: customPath,
    } = options;

    let page;
    let pageId;

    try {
      // Create a new page for this screenshot
      const pageInfo = await browserManager.createPage();
      page = pageInfo.page;
      pageId = pageInfo.pageId;

      // Set viewport if provided
      if (viewport.width && viewport.height) {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor || 1,
        });
      }

      // Navigate to the URL
      await browserManager.navigateToUrl(pageId, url, {
        waitUntil: "networkidle2",
        waitForSelector,
        waitForTimeout,
      });

      // Wait for additional time if specified
      if (options.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }

      // Scroll to the element if selector is provided
      let clip;
      if (selector) {
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Element not found with selector: ${selector}`);
        }

        // Scroll to the element
        await element.evaluate((el) =>
          el.scrollIntoView({ behavior: "smooth", block: "center" })
        );

        // Get the bounding box of the element
        const boundingBox = await element.boundingBox();
        if (!boundingBox) {
          throw new Error(
            "Could not get bounding box for the selected element"
          );
        }

        // Adjust the clip to include the element with some padding
        const padding = options.padding || 0;
        clip = {
          x: Math.max(0, boundingBox.x - padding),
          y: Math.max(0, boundingBox.y - padding),
          width: boundingBox.width + padding * 2,
          height: boundingBox.height + padding * 2,
        };
      }

      // Determine output directory and filename
      let outputDir;
      let outputFileName;
      if (customPath) {
        // If customPath is a file, use its dirname and basename
        const stat = fs.existsSync(customPath) ? fs.statSync(customPath) : null;
        if (stat && stat.isDirectory()) {
          outputDir = resolveAbsolutePath(customPath);
          outputFileName = fileName;
        } else {
          outputDir = resolveAbsolutePath(path.dirname(customPath));
          outputFileName = path.basename(customPath);
        }
      } else {
        outputDir = resolveAbsolutePath(config.getScreenshotConfig().directory);
        outputFileName = fileName;
      }
      await ensureDirectoryExists(outputDir);
      const outputPath = path.join(outputDir, outputFileName);

      // Take the screenshot
      const screenshotInfo = await browserManager.takeScreenshot(pageId, {
        path: outputPath,
        fullPage: fullPage && !clip, // Don't use fullPage if we have a clip
        type: format,
        quality,
        clip,
      });

      // Store screenshot info
      const screenshotId = `screenshot-${Date.now()}`;
      const screenshotData = {
        id: screenshotId,
        url,
        path: outputPath,
        timestamp: new Date().toISOString(),
        size: screenshotInfo.size,
        viewport: viewport,
        selector,
        format,
      };

      this.screenshots.set(screenshotId, screenshotData);

      logger.success(`Screenshot captured: ${outputPath}`);
      return screenshotData;
    } catch (error) {
      logger.error("Failed to capture screenshot", error);
      throw error;
    } finally {
      // Clean up the page
      if (pageId) {
        try {
          await browserManager.closePage(pageId);
        } catch (error) {
          logger.error("Error cleaning up page", error);
        }
      }
    }
  }

  async captureMultipleScreenshots(urls, options = {}) {
    const results = [];
    const errors = [];

    for (const [index, url] of urls.entries()) {
      try {
        const screenshotOptions = {
          ...options,
          fileName: options.fileName
            ? `${path.basename(
                options.fileName,
                path.extname(options.fileName)
              )}-${index}${path.extname(options.fileName) || ".png"}`
            : undefined,
        };

        const result = await this.capturePageScreenshot(url, screenshotOptions);
        results.push({
          url,
          success: true,
          data: result,
        });
      } catch (error) {
        logger.error(`Failed to capture screenshot for ${url}`, error);
        errors.push({
          url,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      total: urls.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getScreenshotInfo(screenshotId) {
    const screenshot = this.screenshots.get(screenshotId);
    if (!screenshot) {
      throw new Error(`No screenshot found with ID: ${screenshotId}`);
    }

    // Check if the file still exists
    try {
      const stats = fs.statSync(screenshot.path);
      return {
        ...screenshot,
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return {
        ...screenshot,
        exists: false,
        error: "File not found on disk",
      };
    }
  }

  listScreenshots() {
    return Array.from(this.screenshots.entries()).map(([id, info]) => ({
      id,
      ...info,
    }));
  }

  async cleanupOldScreenshots(maxAgeDays = 7) {
    const now = new Date();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    let errorCount = 0;

    for (const [id, screenshot] of this.screenshots.entries()) {
      try {
        const stats = fs.statSync(screenshot.path);
        const fileAge = now - stats.mtime;

        if (fileAge > maxAgeMs) {
          fs.unlinkSync(screenshot.path);
          this.screenshots.delete(id);
          deletedCount++;
          logger.debug(`Deleted old screenshot: ${screenshot.path}`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error cleaning up screenshot ${id}`, error);
      }
    }

    return {
      total: this.screenshots.size,
      deleted: deletedCount,
      errors: errorCount,
    };
  }
}

module.exports = new ScreenshotService();
