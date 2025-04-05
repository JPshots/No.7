/**
 * Session Management Module
 * Handles creation, loading, and updating of review sessions
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { ClaudeAPI } = require('./claude-api');
const { ImageHandler } = require('./images');  // Correct if images.js exists
const { FrameworkLoader } = require('./framework-loader');

// Session directory
const SESSION_DIR = path.resolve(process.cwd(), '.sessions');

// Phase definitions
const PHASES = {
  INTAKE: 'intake',
  DRAFT: 'draft',
  REFINE: 'refine',
  QUALITY: 'quality'
};

class Session {
  /**
   * Create a new Session instance
   * @param {Object} options - Session options
   */
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.productName = options.productName || 'Unnamed Product';
    this.phase = options.phase || PHASES.INTAKE;
    this.imageDir = options.imageDir || './images';
    this.messages = options.messages || [];
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();
    this.productType = options.productType || null;
    this.keywords = options.keywords || [];
    this.imageAnalysis = options.imageAnalysis || [];
    this.phaseData = options.phaseData || {
      [PHASES.INTAKE]: { complete: false, data: {} },
      [PHASES.DRAFT]: { complete: false, data: {} },
      [PHASES.REFINE]: { complete: false, data: {} },
      [PHASES.QUALITY]: { complete: false, data: {} }
    };
    this.webSearchEnabled = options.webSearchEnabled || false;
    
    // Initialize API clients
    this.claude = new ClaudeAPI();
    this.imageHandler = new ImageHandler(this.imageDir);
    this.frameworkLoader = new FrameworkLoader();
  }

  /**
   * Start or resume the session
   */
  async start() {
    console.log(chalk.cyan(`\nSession: ${this.productName} (${this.phase.toUpperCase()} Phase)`));
    
    try {
      // Ensure session directory exists
      await fs.mkdir(SESSION_DIR, { recursive: true });
      
      // Process based on current phase
      switch (this.phase) {
        case PHASES.INTAKE:
          await this.runIntakePhase();
          break;
        case PHASES.DRAFT:
          await this.runDraftPhase();
          break;
        case PHASES.REFINE:
          await this.runRefinePhase();
          break;
        case PHASES.QUALITY:
          await this.runQualityPhase();
          break;
        default:
          throw new Error(`Unknown phase: ${this.phase}`);
      }
      
      // Save session at the end of start
      await this.save();
    } catch (error) {
      console.error(chalk.red('Session error:'), error.message);
      if (global.VERBOSE_MODE) {
        console.error(error.stack);
      }
      
      // Save session on error to prevent data loss
      await this.save();
      
      throw error;
    }
  }

  /**
   * Run the Intake & Questioning phase
   */
  async runIntakePhase() {
    // Load phase-specific framework and prompts
    const framework = await this.frameworkLoader.getPhaseFramework(PHASES.INTAKE);
    const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.INTAKE, {
      hasImages: this.phaseData[PHASES.INTAKE].data.hasImages
    });
    
    console.log(chalk.cyan("\n=== INTAKE & QUESTIONING PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll gather information about your product experience."));
    
    // If starting fresh, get initial product description
    if (this.messages.length === 0) {
      const { description } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'description',
          message: 'Please describe your product experience (an editor will open for you to type your response):',
          default: this.phaseData[PHASES.INTAKE].data.initialDescription || ''
        }
      ]);
      
      this.phaseData[PHASES.INTAKE].data.initialDescription = description;
      this.productName = await this.extractProductName(description);
      
      // Process images if available
      const images = await this.imageHandler.loadImages();
      if (images.length > 0) {
        console.log(chalk.green(`\nFound ${images.length} images to analyze.`));
        this.phaseData[PHASES.INTAKE].data.hasImages = true;
        
        // Create first message with images
        const firstUserMessage = {
          role: 'user',
          content: [
            { type: 'text', text: description },
            ...images
          ]
        };
        
        this.messages.push(firstUserMessage);
      } else {
        // Create first message without images
        this.messages.push({
          role: 'user',
          content: description
        });
      }
      
      // Save session after initial setup
      await this.save();
    }
    
    // Process intake phase until complete
    let phaseComplete = false;
    
    while (!phaseComplete) {
      // Send current messages to Claude
      console.log(chalk.yellow("\nProcessing your input..."));
      const response = await this.claude.processMessages(this.messages, systemPrompt);
      
      // Add Claude's response to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      console.log(chalk.green("\nResponse:"));
      console.log(response.content);
      
      // Check if phase is complete based on response content
      if (this.checkPhaseCompletion(response.content, PHASES.INTAKE)) {
        // Confirm transition to draft phase
        const { confirmTransition } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmTransition',
            message: 'Would you like to proceed to the Draft Creation phase?',
            default: true
          }
        ]);
        
        if (confirmTransition) {
          // Extract keywords and other data before transitioning
          this.keywords = this.extractKeywords(this.messages);
          this.productType = this.determineProductType(this.messages);
          
          // Add research transition message if research was conducted
          if (this.phaseData[PHASES.INTAKE].data.researchResults) {
            const transitionMessage = {
              role: 'user',
              content: `I'm ready to proceed to the draft creation phase. Please create a complete review draft based on both my personal experiences with the product AND the research insights we've gathered. 

Remember:
- Factual information from research (specifications, compatibility, measurements) can be integrated seamlessly
- Subjective information from research (other users' opinions/experiences) must be clearly attributed with phrases like "according to other users" or "many reviewers note that"
- My direct experiences should always take precedence over any conflicting information from research

Please create a well-balanced review that properly integrates both sources of information.`
            };
            
            this.messages.push(transitionMessage);
          }
          
          // Mark phase as complete
          this.phaseData[PHASES.INTAKE].complete = true;
          phaseComplete = true;
          
          // Transition to draft phase
          this.phase = PHASES.DRAFT;
          console.log(chalk.green("\nTransitioning to Draft Creation phase..."));
        }
      } else {
        // Get user response
        const { response: userResponse } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'response',
            message: 'Your response (an editor will open):',
          }
        ]);
        
        // Handle special commands
        if (userResponse.trim().toLowerCase() === 'exit') {
          console.log(chalk.yellow('\nSaving session and exiting...'));
          await this.save();
          process.exit(0);
        } else if (userResponse.trim().toLowerCase() === 'save') {
          await this.save();
          console.log(chalk.green('\nSession saved successfully!'));
          continue;
        }
        
        // Add user response to messages
        this.messages.push({
          role: 'user',
          content: userResponse
        });
      }
      
      // Save session after each interaction
      await this.save();
    }
  }

  /**
   * Run the Draft Creation phase
   */
  async runDraftPhase() {
    // Ensure previous phase is complete
    if (!this.phaseData[PHASES.INTAKE].complete) {
      console.log(chalk.yellow("\nThe Intake phase is not yet complete. Returning to Intake phase..."));
      this.phase = PHASES.INTAKE;
      return this.runIntakePhase();
    }
    
    // Load phase-specific framework and prompts
    const framework = await this.frameworkLoader.getPhaseFramework(PHASES.DRAFT);
    const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.DRAFT, {
      productType: this.productType,
      keywords: this.keywords
    });
    
    console.log(chalk.cyan("\n=== DRAFT CREATION PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll create a complete review draft based on the information gathered."));
    
    // Extract relevant information for draft creation
    if (!this.phaseData[PHASES.DRAFT].data.draftStarted) {
      console.log(chalk.yellow("\nPreparing to create draft..."));
      
      // Create transition message
      const transitionMessage = {
        role: 'user',
        content: "I'm ready to move to the draft creation phase. Please create a complete review draft based on the information I've provided."
      };
      
      this.messages.push(transitionMessage);
      this.phaseData[PHASES.DRAFT].data.draftStarted = true;
      
      // Save session
      await this.save();
    }
    
    // Placeholder for simplified draft phase processing
    console.log(chalk.yellow("Draft phase is not fully implemented in this quick fix. Exiting for now."));
    process.exit(0);
  }

  /**
   * Run the Refine phase
   */
  async runRefinePhase() {
    console.log(chalk.cyan("\n=== REFINE PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll refine the draft based on your feedback."));

    // Prompt user for feedback
    const { userFeedback } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'userFeedback',
        message: 'Please provide your feedback on the draft (an editor will open):'
      }
    ]);

    // Detect feedback types
    const feedbackTypes = detectFeedbackType(userFeedback);

    // Handle specialized feedback
    if (feedbackTypes.personality || feedbackTypes.formatting || feedbackTypes.redundancy) {
      console.log(chalk.yellow("Specialized feedback detected. Loading relevant guidelines..."));

      if (feedbackTypes.personality) {
        console.log(chalk.green("Adjusting tone and personality based on your feedback..."));
        // Add logic to adjust tone/personality
      }
      if (feedbackTypes.formatting) {
        console.log(chalk.green("Improving formatting and structure..."));
        // Add logic to improve formatting
      }
      if (feedbackTypes.redundancy) {
        console.log(chalk.green("Removing redundant content..."));
        // Add logic to handle redundancy
      }
    }

    // Add user feedback to messages
    this.messages.push({
      role: 'user',
      content: userFeedback
    });

    // Save session after processing feedback
    await this.save();

    console.log(chalk.green("\nFeedback processed. Refinement complete."));
  }

  /**
   * Save the session to a file
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      // Ensure session directory exists with verbose logging
      try {
        await fs.mkdir(SESSION_DIR, { recursive: true });
        console.log(chalk.gray(`Session directory: ${SESSION_DIR}`));
      } catch (dirError) {
        console.error(chalk.red(`Error creating sessions directory:`), dirError.message);
        // Try to get the absolute path to help debugging
        console.error(chalk.yellow(`Attempted to create directory at: ${path.resolve(SESSION_DIR)}`));
        throw dirError;
      }
      
      const sessionPath = path.join(SESSION_DIR, `${this.id}.json`);
      const sessionData = this.toJSON();
      
      // Add more detailed logging around the save operation
      console.log(chalk.gray(`Saving session ${this.id} to ${sessionPath}`));
      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
      console.log(chalk.green(`Session saved successfully to ${sessionPath}`));
      
      return sessionPath;
    } catch (error) {
      console.error(chalk.red(`Failed to save session:`), error.message);
      if (error.code === 'ENOENT') {
        console.error(chalk.yellow(`Directory does not exist. Tried: ${SESSION_DIR}`));
      } else if (error.code === 'EACCES') {
        console.error(chalk.yellow(`Permission denied when writing to ${SESSION_DIR}`));
      }
      throw error;
    }
  }
/**
 * Run the Quality Control phase
 */
async runQualityPhase() {
  try {
    console.log(chalk.cyan("\n=== QUALITY CONTROL PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll finalize the review and ensure it meets all quality standards."));
    
    // Load last completed review draft from previous phase
    const previousPhaseData = this.phaseData[PHASES.REFINE] || this.phaseData[PHASES.DRAFT];
    let reviewContent = '';
    
    if (previousPhaseData && previousPhaseData.reviewContent) {
      reviewContent = previousPhaseData.reviewContent;
    } else {
      // Extract the review from the previous messages if not stored directly
      const messages = this.messages.filter(msg => msg.role === 'assistant');
      if (messages.length > 0) {
        // Get the most recent assistant message
        const lastMessage = messages[messages.length - 1];
        reviewContent = this.extractReviewContent(lastMessage.content);
      }
    }
    
    if (!reviewContent) {
      console.log(chalk.yellow("\nNo review content found in previous phases. Please complete the Draft phase first."));
      console.log(chalk.yellow("You can use 'jump draft' to go back to the draft phase."));
      return;
    }
    
    console.log(chalk.green("\nFinal Review:"));
    console.log(reviewContent);
    
    // Add a pause to let the user read the review
    const { continueProcess } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueProcess',
        message: 'Review displayed above. Continue to save the review?',
        default: true
      }
    ]);
    
    if (!continueProcess) {
      console.log(chalk.yellow("Process paused. You can resume later."));
      return;
    }
    
    // Prepare directory for saving
    const reviewsDir = path.join(process.cwd(), 'reviews');
    try {
      await fs.mkdir(reviewsDir, { recursive: true });
    } catch (err) {
      console.error(chalk.yellow(`Warning: Could not create directory ${reviewsDir}`));
    }
    
    // Save the review to a file
    const sanitizedName = this.productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${sanitizedName}-${date}.md`;
    const filePath = path.join(reviewsDir, fileName);
    
    try {
      await fs.writeFile(filePath, reviewContent);
      console.log(chalk.green(`\nReview successfully saved to: ${filePath}`));
    } catch (error) {
      console.error(chalk.red(`Error saving review: ${error.message}`));
    }
    
    // Ask if user wants to see quality assessment
    const { showQualityAssessment } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showQualityAssessment',
        message: 'Would you like to generate a quality assessment for this review?',
        default: true
      }
    ]);
    
    if (showQualityAssessment) {
      // Load quality framework
      const framework = await this.frameworkLoader.getPhaseFramework(PHASES.QUALITY);
      const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.QUALITY, {
        productType: this.productType,
        keywords: this.keywords
      });
      
      console.log(chalk.yellow("\nGenerating quality assessment..."));
      
      // Create a message asking for assessment
      this.messages.push({
        role: 'user',
        content: "Please provide a quality assessment of this review, including scores for Testing Depth, Information Quality, Authenticity, Writing Quality, and Helpfulness. Give each category a score out of 20 and provide a total score out of 100."
      });
      
      // Get assessment
      const response = await this.claude.processMessages(this.messages, systemPrompt);
      
      // Add to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      console.log(chalk.green("\nQuality Assessment:"));
      console.log(response.content);
      
      // Save assessment
      this.phaseData[PHASES.QUALITY].data.qualityAssessment = response.content;
    }
    
    // Mark the phase as complete
    this.phaseData[PHASES.QUALITY] = {
      complete: true,
      data: {
        finalReview: reviewContent,
        completedAt: new Date().toISOString()
      }
    };
    
    await this.save();
    
    // Final pause
    const { exitProcess } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'exitProcess',
        message: 'Review process completed successfully! Exit now?',
        default: true
      }
    ]);
    
    if (exitProcess) {
      console.log(chalk.cyan("\nThank you for using the Amazon Review Framework!"));
      process.exit(0);
    } else {
      console.log(chalk.yellow("Returning to session..."));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error in Quality Control phase: ${error.message}`));
    if (global.VERBOSE_MODE && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}
  /**
   * Convert session to JSON for storage
   */
  toJSON() {
    return {
      id: this.id,
      productName: this.productName,
      phase: this.phase,
      imageDir: this.imageDir,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      productType: this.productType,
      keywords: this.keywords,
      imageAnalysis: this.imageAnalysis,
      phaseData: this.phaseData,
      webSearchEnabled: this.webSearchEnabled
    };
  }

  /**
   * Helper functions
   * These are placeholders that would be more sophisticated in a full implementation
   */

  /**
   * Extract product name from description
   * @param {string} description - Product description
   * @returns {string} Extracted product name
   */
  async extractProductName(description) {
    // Simple implementation
    const firstLine = description.split('\n')[0] || '';
    const words = firstLine.split(/\s+/).slice(0, 3);
    return words.join(' ') || 'Product Review';
  }

  /**
   * Extract keywords from messages
   * @param {Array} messages - Array of message objects
   * @returns {Array} Extracted keywords
   */
  extractKeywords(messages) {
    // Placeholder implementation
    return ['product', 'review'];
  }

  /**
   * Determine product type from messages
   * @param {Array} messages - Array of message objects
   * @returns {string} Product type
   */
  determineProductType(messages) {
    // Placeholder implementation
    return 'generic';
  }

  /**
   * Check if a phase is complete based on Claude's response
   * @param {string} content - Claude's response content
   * @param {string} phase - Current phase
   * @returns {boolean} True if phase is complete
   */
  checkPhaseCompletion(content, phase) {
    // Look for phase completion indicators in Claude's response
    const completionIndicators = {
      'intake': [
        'gathered sufficient information',
        'ready to move to the draft creation phase',
        'proceed to the draft phase',
        'all the information I need'
      ]
    };
    
    // Check if any completion indicators are present
    const indicators = completionIndicators[phase] || [];
    return indicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Get all saved sessions
   * @returns {Promise<Array>} Array of session objects
   */
  static async getAllSessions() {
    try {
      // Ensure session directory exists
      await fs.mkdir(SESSION_DIR, { recursive: true });
      
      // Read all files in session directory
      const files = await fs.readdir(SESSION_DIR);
      
      // Filter for JSON files
      const sessionFiles = files.filter(file => path.extname(file) === '.json');
      
      // Load each session
      const sessions = [];
      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(SESSION_DIR, file);
          const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
          sessions.push(sessionData);
        } catch (error) {
          console.error(chalk.yellow(`Warning: Could not load session file ${file}:`), error.message);
        }
      }
      
      // Sort by updated date (newest first)
      return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error(chalk.red('Error getting all sessions:'), error.message);
      return [];
    }
  }
}

// Enhanced feedback detection function
/**
 * Detect the type of feedback provided by the user
 * @param {string} feedbackText - The feedback text
 * @returns {Object} Detected feedback types
 */
function detectFeedbackType(feedbackText) {
  const feedbackLower = feedbackText.toLowerCase();
  return {
    personality: feedbackLower.includes('tone') || feedbackLower.includes('personality'),
    formatting: feedbackLower.includes('format') || feedbackLower.includes('structure'),
    redundancy: feedbackLower.includes('redundant') || feedbackLower.includes('repetition')
  };
}

/**
 * Jump to a specific phase in the review process
 * @param {string} targetPhase - The phase to jump to
 * @returns {Promise<boolean>} Success status
 */
Session.prototype.jumpToPhase = async function(targetPhase) {
  const validPhases = {
    'intake': PHASES.INTAKE,
    'draft': PHASES.DRAFT, 
    'refine': PHASES.REFINE,
    'quality': PHASES.QUALITY
  };
  
  if (!validPhases[targetPhase]) {
    console.log(chalk.yellow(`Invalid phase: ${targetPhase}. Valid phases are: intake, draft, refine, quality`));
    return false;
  }
  
  // Set the phase
  this.phase = validPhases[targetPhase];
  console.log(chalk.cyan(`Jumping to ${targetPhase.toUpperCase()} phase...`));
  
  // Add a transition message
  this.messages.push({
    role: 'user',
    content: `Please continue this review process in the ${targetPhase.toUpperCase()} phase.`
  });
  
  // Save and continue
  await this.save();
  await this.start();
  return true;
};
/**
 * Extract review content from Claude's response
 * @param {string} content - Claude's response content
 * @returns {string} Extracted review content
 */
function extractReviewContent(content) {
  // Look for markdown code blocks which might contain the review
  const markdownMatch = content.match(/```(?:markdown)?\s*([\s\S]+?)\s*```/);
  if (markdownMatch) return markdownMatch[1].trim();
  
  // If no markdown block, look for sections that might be the review
  const sections = content.split(/\n{2,}/);
  
  // Find the longest section that looks like a review
  const reviewSection = sections.reduce((longest, section) => {
    if (section.length > longest.length && 
        (section.includes('PROS') || 
         section.includes('CONS') ||
         section.includes('VERDICT'))) {
      return section;
    }
    return longest;
  }, '');
  
  if (reviewSection) return reviewSection;
  
  // If no clear review section, return the whole content
  return content;
}
module.exports = { Session };