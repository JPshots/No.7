// amazon-framework-chat-enhanced.js
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Base directory for YAML files and images
const YAML_DIR = './YAML/';
const IMAGES_DIR = './images/';

// Framework files to load
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

// Helper function to load and encode images
async function loadImages() {
  try {
    const imageFiles = await fs.readdir(IMAGES_DIR).catch(() => {
      console.log("No images directory found or it's empty");
      return [];
    });
    
    // Filter for image files only
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const validImageFiles = imageFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return validImageExtensions.includes(ext);
    });
    
    if (validImageFiles.length === 0) {
      console.log("No valid images found in the images directory");
      return [];
    }
    
    console.log(`Found ${validImageFiles.length} images to analyze`);
    
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
        
        console.log(`Processed image: ${filename}`);
      } catch (error) {
        console.error(`Error processing image ${filename}:`, error.message);
      }
    }
    
    return images;
  } catch (error) {
    console.error("Error loading images:", error);
    return [];
  }
}

// Main function to start the chat
async function startFrameworkChat() {
  try {
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ERROR: ANTHROPIC_API_KEY is not set in your environment variables or .env file");
      console.log("Please make sure you have created a .env file with your API key");
      process.exit(1);
    }
    
    console.log("API key found. Loading framework files...");
    
    // Load all framework files
    let frameworkContent = '';
    for (const filename of FRAMEWORK_FILES) {
      const filePath = path.join(YAML_DIR, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        frameworkContent += `\n\n# ${filename}\n${content}`;
      } catch (error) {
        console.error(`Error loading ${filename}:`, error.message);
      }
    }
    
    // Load images for analysis
    console.log("Loading images from the images directory...");
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

    console.log("Starting chat with Claude. Type 'exit' to end the session.");
    console.log("-------------------------------------------------------");
    
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
    console.log("\nClaude: " + initialMessage.content);
    
    // Start the conversation loop with the images if available
    await chatLoop(messages, systemPrompt, images);
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Function to handle the ongoing chat
async function chatLoop(messages, systemPrompt, images = []) {
  // Flag to track if this is the first message (to include images)
  let isFirstUserMessage = true;
  
  while (true) {
    // Get user input
    const userInput = await getUserInput("\nYou: ");
    
    // Check if user wants to exit
    if (userInput.toLowerCase() === 'exit') {
      console.log("\nEnding session. Goodbye!");
      break;
    }
    
    try {
      console.log("Getting response from Claude...");
      
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
      }
      
      // Log API request (for debugging)
      console.log(`Sending message to Claude with ${messagesCopy.length} messages`);
      console.log(`Images included: ${isFirstUserMessage && images.length > 0 ? 'Yes' : 'No'}`);
      
      // Get Claude's response
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        system: systemPrompt,
        max_tokens: 4000,
        messages: messagesCopy
      });
      
      // Log response received (for debugging)
      console.log("Received response from Claude");
      
      // Get Claude's response text
      const claudeResponse = response.content[0].text;
      
      // Add Claude's response to the conversation
      messages.push({
        role: "assistant",
        content: claudeResponse
      });
      
      // Display Claude's response
      console.log("\nClaude: " + claudeResponse);
      
      // No longer the first message
      isFirstUserMessage = false;
      
    } catch (error) {
      console.error("Error from Claude API:", error.message);
      if (error.response) {
        console.error("API Response:", error.response.data);
      }
      console.error("Check your API key and make sure it's valid");
    }
  }
  
  // Close the readline interface
  rl.close();
}

// Helper function to get user input
function getUserInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Start the chat
startFrameworkChat();