// review-generator.js - Implementation script for Amazon Review Framework

const framework = require('./config.js');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables for API key
require('dotenv').config();

async function ensureImageDirectory() {
  try {
    await fs.mkdir('./images', { recursive: true });
    console.log("Images directory is ready.");
  } catch (error) {
    console.error("Error creating images directory:", error);
  }
}

async function runReviewWorkflow() {
  console.log("=== Amazon Review Framework ===");
  console.log("This tool will help you create exceptional product reviews using Claude and the framework.\n");
  
  // Ensure the images directory exists
  await ensureImageDirectory();
  
  console.log("Note: You can add product images to the './images' folder before continuing.");
  console.log("These images will be analyzed as part of the review process.\n");
  
  // Check if there are any images and list them
  try {
    const imageFiles = await fs.readdir('./images');
    const validImages = imageFiles.filter(file => 
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)
    );
    
    if (validImages.length > 0) {
      console.log("Found the following images that will be processed:");
      validImages.forEach(img => console.log(`- ${img}`));
    } else {
      console.log("No images found in the './images' folder. You can continue without images or add some now.");
    }
    console.log("");
  } catch (error) {
    console.error("Error reading images directory:", error);
  }
  
  // Get user input about their product experience
  const userInput = await new Promise(resolve => {
    rl.question("Please describe your product experience (include product name, what you liked/disliked, etc.):\n", answer => {
      resolve(answer);
    });
  });
  
  console.log("\nGenerating review using the framework...");
  console.log("(This may take a moment as Claude processes the framework files, your input, and any images)\n");
  
  try {
    // Generate the review
    const review = await framework.generateReview(userInput);
    
    console.log("=== Generated Review ===\n");
    console.log(review);
    
    // Save the review to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `review-${timestamp}.txt`;
    await fs.writeFile(filename, review);
    console.log(`\nReview saved to ${filename}`);
    
    // Ask if user wants to make revisions
    const revise = await new Promise(resolve => {
      rl.question("\nWould you like to make revisions to this review? (yes/no): ", answer => {
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (revise) {
      await handleRevisions(review, userInput);
    } else {
      console.log("\nThank you for using the Amazon Review Framework!");
      rl.close();
    }
  } catch (error) {
    console.error("Error:", error.message);
    rl.close();
  }
}

async function handleRevisions(originalReview, userInput) {
  // Get user feedback for revisions
  const feedback = await new Promise(resolve => {
    rl.question("\nPlease provide your feedback on what to revise:\n", answer => {
      resolve(answer);
    });
  });
  
  console.log("\nGenerating revised review...");
  
  try {
    // Create a special prompt for revisions
    const { Anthropic } = require('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const revisionPrompt = `
You previously created this product review based on the Amazon Review Framework:

${originalReview}

The user has provided this feedback for revisions:
${feedback}

Please revise the review according to this feedback while maintaining alignment with the Amazon Review Framework. Keep the same structure and formatting, but incorporate the requested changes.
`;
    
    const response = await client.messages.create({
      model: framework.CLAUDE_CONFIG.model,
      max_tokens: framework.CLAUDE_CONFIG.max_tokens,
      temperature: framework.CLAUDE_CONFIG.temperature,
      top_p: framework.CLAUDE_CONFIG.top_p,
      top_k: framework.CLAUDE_CONFIG.top_k,
      system: "You are an expert in creating exceptional product reviews following the Amazon Review Framework. You can also use web search when necessary to find additional information about products or topics mentioned.",
      messages: [
        { role: "user", content: revisionPrompt }
      ],
      tools: [{ name: "web_search" }]
    });
    
    const revisedReview = response.content[0].text;
    
    console.log("=== Revised Review ===\n");
    console.log(revisedReview);
    
    // Save the revised review
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `review-revised-${timestamp}.txt`;
    await fs.writeFile(filename, revisedReview);
    console.log(`\nRevised review saved to ${filename}`);
    
    // Ask if user wants to make further revisions
    const continueRevising = await new Promise(resolve => {
      rl.question("\nWould you like to make further revisions? (yes/no): ", answer => {
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (continueRevising) {
      await handleRevisions(revisedReview, userInput);
    } else {
      console.log("\nThank you for using the Amazon Review Framework!");
      rl.close();
    }
  } catch (error) {
    console.error("Error during revision:", error.message);
    rl.close();
  }
}

// Run the workflow
runReviewWorkflow().catch(console.error);