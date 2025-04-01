#!/usr/bin/env node
/**
 * Setup script to create required directories
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Required directories
const dirs = [
  '.sessions',
  'images',
  'reviews',
  'framework',
  'framework/phases'
];

console.log(chalk.cyan('Setting up Amazon Review Framework CLI directories...'));

// Create each directory
dirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(`✓ Created directory: ${dir}`));
    } catch (error) {
      console.error(chalk.red(`✗ Error creating directory ${dir}:`), error.message);
    }
  } else {
    console.log(chalk.yellow(`! Directory already exists: ${dir}`));
  }
});

console.log(chalk.green('\nSetup complete!'));
console.log(chalk.yellow('\nRemember to:'));
console.log(chalk.yellow('1. Create a .env file with your Anthropic API key (see .env.example)'));
console.log(chalk.yellow('2. Place your product images in the "images" directory before starting a review'));

console.log(chalk.cyan('\nRun "node amazon-review.js" to start creating reviews!'));
