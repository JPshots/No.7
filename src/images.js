/**
 * Image Handling Module
 * Handles loading, processing, and encoding images for use with Claude API
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Class for handling images in the Amazon Review Framework
 */
class ImageHandler {
  /**
   * Create a new ImageHandler
   * @param {string} imageDir - Directory containing product images
   */
  constructor(imageDir = './images') {
    this.imageDir = imageDir;
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  }

  /**
   * Load all images from the image directory
   * @returns {Promise<Array>} Array of image objects in Claude API format
   */
  async loadImages() {
    try {
      // Ensure image directory exists
      try {
        await fs.mkdir(this.imageDir, { recursive: true });
      } catch (error) {
        // Directory already exists or can't be created
        if (error.code !== 'EEXIST') {
          console.error(chalk.red(`Error creating image directory ${this.imageDir}:`), error.message);
        }
      }
      
      // Read all files in the image directory
      const files = await fs.readdir(this.imageDir);
      
      // Filter for supported image formats
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });
      
      if (imageFiles.length === 0) {
        return [];
      }
      
      // Convert images to Claude API format
      const images = [];
      for (const file of imageFiles) {
        try {
          const imagePath = path.join(this.imageDir, file);
          const imageData = await fs.readFile(imagePath);
          const base64Image = imageData.toString('base64');
          
          // Determine MIME type
          const ext = path.extname(file).toLowerCase();
          const mimeType = this.getMimeType(ext);
          
          // Create image object for Claude API
          images.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image
            }
          });
          
          if (global.VERBOSE_MODE) {
            console.log(chalk.gray(`Loaded image: ${file}`));
          }
        } catch (error) {
          console.error(chalk.yellow(`Error loading image ${file}:`), error.message);
        }
      }
      
      return images;
    } catch (error) {
      console.error(chalk.red(`Error loading images from ${this.imageDir}:`), error.message);
      return [];
    }
  }

  /**
   * Get MIME type for file extension
   * @param {string} extension - File extension
   * @returns {string} MIME type
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    };
    
    return mimeTypes[extension] || 'image/jpeg';
  }

  /**
   * Process image analysis from Claude responses
   * @param {Array} messages - Array of message objects
   * @returns {Array} Extracted image analysis insights
   */
  extractImageAnalysis(messages) {
    // Find messages where Claude analyzed images
    const analysisMessages = messages.filter(message => 
      message.role === 'assistant' && 
      message.content && 
      message.content.includes('image') && 
      message.content.includes('analysis')
    );
    
    // Extract key insights
    const insights = [];
    
    if (analysisMessages.length === 0) {
      return insights;
    }
    
    // Simple extraction of image-related sentences
    for (const message of analysisMessages) {
      const sentences = message.content.split(/[.!?]\s+/);
      
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes('image') || 
            sentence.toLowerCase().includes('photo') || 
            sentence.toLowerCase().includes('picture')) {
          insights.push(sentence.trim());
        }
      }
    }
    
    // Remove duplicates and limit to most relevant insights
    return [...new Set(insights)].slice(0, 10);
  }
}

module.exports = { ImageHandler };