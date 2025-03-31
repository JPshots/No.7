#!/usr/bin/env node
// amazon-review-cli.js - CLI interface for the Amazon Review Framework

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const readline = require('readline');
const chalk = require('chalk'); // For colored terminal output

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base directories
const YAML_DIR = './YAML/';
const IMAGES_DIR = './images/';

// Framework files to load (in specific order)
const FRAMEWORK_FILES = [
  'framework-overview.yaml',  // Load this first as it's the overview
  'review-strategy.yaml',
  'question-framework.yaml',
  'personality-balance.yaml',
  'creative-techniques.yaml',
  'content-structure.yaml', 
  'formatting-and-style.yaml',
  'keyword-strategy.yaml',
  'quality-control.yaml',
  'writing-process.yaml'
];

// Valid image extensions
const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

// Ensure images directory exists
async function ensureDirectories() {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    console.log(chalk.green('✓ Images directory is ready'));
  } catch (error) {
    console.error(chalk.red('Error ensuring directories:'), error.message);
  }
}

// Helper function to load and encode images
async function loadImages() {
  try {
    const imageFiles = await fs.readdir(IMAGES_DIR).catch(() => {
      console.log(chalk.yellow("No images directory found or it's empty"));
      return [];
    });
    
    // Filter for image files only
    const validImageFiles = imageFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return VALID_IMAGE_EXTENSIONS.includes(ext);
    });
    
    if (validImageFiles.length === 0) {
      console.log(chalk.yellow("No valid images found in the images directory"));
      return [];
    }
    
    console.log(chalk.green(`Found ${validImageFiles.length} images to analyze`));
    
    // Process each image
    const images = [];
    for (const filename of validImageFiles) {
      const filePath = path.join(IMAGES_DIR, filename);
      try {
        // Read the image file
        const imageBuffer = await fs.readFile(filePath);
        // Convert to base64
        const base64Image = imageBuffer.toString('base64');
        // Determine MIME type based on extension
        let mimeType = 'image/jpeg'; // Default
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.bmp') mimeType = 'image/bmp';
        
        images.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType,
            data: base64Image
          }
        });
        
        console.log(chalk.green(`✓ Processed image: ${filename}`));
      } catch (error) {
        console.error(chalk.red(`Error processing image ${filename}:`), error.message);
      }
    }
    
    return images;
  } catch (error) {
    console.error(chalk.red("Error loading images:"), error);
    return [];
  }
}

// Load framework files and combine into a single context
async function loadFrameworkFiles() {
  console.log(chalk.cyan('Loading framework files...'));
  
  let frameworkContent = '';
  let loadedFiles = 0;
  
  for (const filename of FRAMEWORK_FILES) {
    const filePath = path.join(YAML_DIR, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      frameworkContent += `\n\n# ${filename}\n${content}`;
      loadedFiles++;
      console.log(chalk.green(`✓ Loaded ${filename}`));
    } catch (error) {
      console.error(chalk.red(`Error loading ${filename}:`), error.message);
    }
  }
  
  console.log(chalk.green(`Successfully loaded ${loadedFiles}/${FRAMEWORK_FILES.length} framework files`));
  
  return frameworkContent;
}

// Helper function to get user input
function getUserInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Function to handle the ongoing chat
async function chatLoop(messages, systemPrompt, images = []) {
  // Flag to track if this is the first message (to include images)
  let isFirstUserMessage = true;
  
  // Enable saving conversation
  let savingEnabled = true;
  let conversationHistory = [];
  
  const saveConversation = async () => {
    if (!savingEnabled) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `review-conversation-${timestamp}.json`;
      await fs.writeFile(filename, JSON.stringify(conversationHistory, null, 2));
      console.log(chalk.green(`Conversation saved to ${filename}`));
    } catch (error) {
      console.error(chalk.red('Error saving conversation:'), error.message);
    }
  };
  
  while (true) {
    // Get user input
    const userInput = await getUserInput(chalk.cyan("\nYou: "));
    
    // Check for commands
    if (userInput.toLowerCase() === 'exit') {
      console.log(chalk.yellow("\nEnding session. Saving conversation..."));
      await saveConversation();
      console.log(chalk.yellow("Goodbye!"));
      break;
    }
    
    if (userInput.toLowerCase() === 'save') {
      await saveConversation();
      continue;
    }
    
    try {
      console.log(chalk.cyan("Getting response from Claude..."));
      
      // Create a copy of messages for API call
      const messagesCopy = [...messages];
      
      // Add the new user message
      if (isFirstUserMessage && images.length > 0) {
        // For the first message, include images if available
        const content = [
          { type: "text", text: userInput },
          ...images
        ];
        
        // Store just the text in our local message history
        messages.push({ 
          role: "user", 
          content: userInput
        });
        
        // Add to conversation history
        conversationHistory.push({
          role: "user",
          content: userInput,
          timestamp: new Date().toISOString()
        });
        
        // But send the message with images to the API
        messagesCopy.push({ 
          role: "user", 
          content: content 
        });
      } else {
        // For subsequent messages, no need to include images
        const newUserMessage = {
          role: "user",
          content: userInput
        };
        
        messages.push(newUserMessage);
        messagesCopy.push(newUserMessage);
        
        // Add to conversation history
        conversationHistory.push({
          role: "user",
          content: userInput,
          timestamp: new Date().toISOString()
        });
      }
      
      // Initialize Anthropic client (inside the loop to handle API key changes)
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || ''
      });
      
      // Get Claude's response
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        system: systemPrompt,
        max_tokens: 4000,
        messages: messagesCopy
      });
      
      // Get Claude's response text
      const claudeResponse = response.content[0].text;
      
      // Add Claude's response to the conversation
      messages.push({
        role: "assistant",
        content: claudeResponse
      });
      
      // Add to conversation history
      conversationHistory.push({
        role: "assistant",
        content: claudeResponse,
        timestamp: new Date().toISOString()
      });
      
      // Display Claude's response
      console.log(chalk.magenta("\nClaude: ") + claudeResponse);
      
      // No longer the first message
      isFirstUserMessage = false;
      
    } catch (error) {
      console.error(chalk.red("Error from Claude API:"), error.message);
      if (error.response) {
        console.error(chalk.red("API Response:"), error.response.data);
      }
      console.error(chalk.red("Check your API key and make sure it's valid"));
    }
  }
  
  // Close the readline interface
  rl.close();
}

// Main function to start the chat
async function startFrameworkChat() {
  try {
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(chalk.red("ERROR: ANTHROPIC_API_KEY is not set in your environment variables or .env file"));
      console.log(chalk.yellow("Please make sure you have created a .env file with your API key"));
      process.exit(1);
    }
    
    console.log(chalk.green("API key found."));
    
    // Ensure directories exist
    await ensureDirectories();
    
    // Load framework files
    const frameworkContent = await loadFrameworkFiles();
    
    // Load images for analysis
    console.log(chalk.cyan("Loading images from the images directory..."));
    const images = await loadImages();
    
    // Create system instructions with all framework files
    const systemPrompt = `
You are an expert product reviewer using the Amazon Review Framework to create exceptional reviews.
The complete framework is provided below. Use these instructions to guide your interactions
and to help create great product reviews based on user experiences.

${frameworkContent}

Remember that YOU (Claude) are the primary writer, creating a framework-based review using the human's input.
The human provides product experiences and observations; YOU craft these into a complete review.

Important: The user has provided product images for you to analyze. Please examine these images
carefully to gather additional context about the product's appearance, features, size, and other 
relevant details. Use the image_processing_framework section from question_framework.yaml to guide
your analysis of these images.

First ask the user questions following the question-framework.yaml approach, then help create an 
exceptional review following all the framework guidelines.
`;

    console.log(chalk.cyan('\n=============================================='));
    console.log(chalk.cyan('    Amazon Review Framework CLI Assistant'));
    console.log(chalk.cyan('=============================================='));
    console.log(chalk.yellow("Commands:"));
    console.log(chalk.yellow("  exit - End session and save conversation"));
    console.log(chalk.yellow("  save - Save current conversation"));
    console.log(chalk.cyan('==============================================\n'));
    
    // Create the initial message with appropriate content based on images
    const initialMessage = {
      role: "assistant",
      content: images.length > 0 
        ? "Hello! I'm Claude, your Amazon Review Framework assistant. I'll help you create an exceptional product review following the framework guidelines. I can see you've provided product images that I'll analyze to understand the product better. To get started, could you tell me about your experience with this product?"
        : "Hello! I'm Claude, your Amazon Review Framework assistant. I'll help you create an exceptional product review following the framework guidelines. To get started, could you tell me about the product you'd like to review and your experience with it?"
    };
    
    // Start the conversation with the assistant message
    const messages = [initialMessage];
    
    // Print the initial message
    console.log(chalk.magenta("Claude: ") + initialMessage.content);
    
    // Start the conversation loop with the images if available
    await chatLoop(messages, systemPrompt, images);
    
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

// Start the chat
startFrameworkChat();