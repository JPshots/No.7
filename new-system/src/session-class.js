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
const { ImageHandler } = require('./images');
const { FrameworkLoader } = require('./framework-loader');

// Session directory
const SESSION_DIR = path.join(process.cwd(), '.sessions');

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
    const systemPrompt = await this.frameworkLoader.loadSystemPrompt(PHASES.INTAKE);
    
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
    
    // Start the next phase
    await this.runDraftPhase();
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
    
    // Process draft phase
    let phaseComplete = false;
    
    while (!phaseComplete) {
      // Send current messages to Claude
      console.log(chalk.yellow("\nGenerating review draft..."));
      const response = await this.claude.processMessages(this.messages, systemPrompt);
      
      // Add Claude's response to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      console.log(chalk.green("\nDraft review:"));
      console.log(response.content);
      
      // Extract the review draft for storage
      this.phaseData[PHASES.DRAFT].data.reviewDraft = this.extractReviewDraft(response.content);
      
      // Process image documentation if needed
      if (this.phaseData[PHASES.INTAKE].data.hasImages && !this.phaseData[PHASES.DRAFT].data.imageDocumentation) {
        this.phaseData[PHASES.DRAFT].data.imageDocumentation = this.extractImageAnalysis(this.messages);
      }
      
      // Check if phase is complete
      if (this.checkPhaseCompletion(response.content, PHASES.DRAFT)) {
        // Ask user to confirm draft is satisfactory
        const { isDraftSatisfactory } = await inquirer.prompt([
          {
            type: 'list',
            name: 'isDraftSatisfactory',
            message: 'How would you like to proceed with this draft?',
            choices: [
              { name: 'Proceed to Refinement phase', value: 'proceed' },
              { name: 'Request changes to the draft', value: 'refine' },
              { name: 'Save and exit', value: 'exit' }
            ]
          }
        ]);
        
        if (isDraftSatisfactory === 'proceed') {
          // Mark phase as complete
          this.phaseData[PHASES.DRAFT].complete = true;
          phaseComplete = true;
          
          // Transition to refinement phase
          this.phase = PHASES.REFINE;
          console.log(chalk.green("\nTransitioning to Refinement phase..."));
        } else if (isDraftSatisfactory === 'refine') {
          // Get specific feedback
          const { feedback } = await inquirer.prompt([
            {
              type: 'editor',
              name: 'feedback',
              message: 'Please provide specific feedback for improving the draft:',
            }
          ]);
          
          // Add feedback to messages
          this.messages.push({
            role: 'user',
            content: feedback
          });
        } else if (isDraftSatisfactory === 'exit') {
          console.log(chalk.yellow('\nSaving session and exiting...'));
          await this.save();
          process.exit(0);
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
    
    // Start the next phase
    await this.runRefinePhase();
  }

  /**
   * Run the Refinement phase
   */
  async runRefinePhase() {
    // Ensure previous phase is complete
    if (!this.phaseData[PHASES.DRAFT].complete) {
      console.log(chalk.yellow("\nThe Draft Creation phase is not yet complete. Returning to Draft phase..."));
      this.phase = PHASES.DRAFT;
      return this.runDraftPhase();
    }
    
    // Load phase-specific framework and prompts
    const framework = await this.frameworkLoader.getPhaseFramework(PHASES.REFINE);
    const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.REFINE, {
      productType: this.productType,
      keywords: this.keywords,
      imageAnalysis: this.phaseData[PHASES.DRAFT].data.imageDocumentation
    });
    
    console.log(chalk.cyan("\n=== REFINEMENT PHASE ==="));
    console.log(chalk.yellow("In this phase, we'll improve the review based on your feedback."));
    
    // Initialize refinement phase if needed
    if (!this.phaseData[PHASES.REFINE].data.refinementStarted) {
      console.log(chalk.yellow("\nPreparing for refinement..."));
      
      // Create transition message
      const transitionMessage = {
        role: 'user',
        content: "I'm ready to refine the review. Let me know what aspects you'd like me to provide feedback on."
      };
      
      this.messages.push(transitionMessage);
      this.phaseData[PHASES.REFINE].data.refinementStarted = true;
      this.phaseData[PHASES.REFINE].data.iterations = 0;
      
      // Save session
      await this.save();
    }
    
    // Process refinement phase
    let phaseComplete = false;
    
    while (!phaseComplete) {
      // Send current messages to Claude
      console.log(chalk.yellow("\nProcessing refinement..."));
      const response = await this.claude.processMessages(this.messages, systemPrompt);
      
      // Add Claude's response to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      console.log(chalk.green("\nRefined review:"));
      console.log(response.content);
      
      // Extract the refined review
      this.phaseData[PHASES.REFINE].data.refinedReview = this.extractReviewDraft(response.content);
      this.phaseData[PHASES.REFINE].data.iterations++;
      
      // Check if phase is complete based on number of iterations and content
      if (this.checkPhaseCompletion(response.content, PHASES.REFINE) || 
          this.phaseData[PHASES.REFINE].data.iterations >= 3) {
        
        // Ask user to confirm refinement is satisfactory
        const { isRefinementSatisfactory } = await inquirer.prompt([
          {
            type: 'list',
            name: 'isRefinementSatisfactory',
            message: 'How would you like to proceed with the refinements?',
            choices: [
              { name: 'Proceed to Quality Control phase', value: 'proceed' },
              { name: 'Continue refining the review', value: 'continue' },
              { name: 'Save and exit', value: 'exit' }
            ]
          }
        ]);
        
        if (isRefinementSatisfactory === 'proceed') {
          // Mark phase as complete
          this.phaseData[PHASES.REFINE].complete = true;
          phaseComplete = true;
          
          // Transition to quality phase
          this.phase = PHASES.QUALITY;
          console.log(chalk.green("\nTransitioning to Quality Control phase..."));
        } else if (isRefinementSatisfactory === 'continue') {
          // Get specific feedback
          const { feedback } = await inquirer.prompt([
            {
              type: 'editor',
              name: 'feedback',
              message: 'Please provide specific feedback for further refinement:',
            }
          ]);
          
          // Add feedback to messages
          this.messages.push({
            role: 'user',
            content: feedback
          });
        } else if (isRefinementSatisfactory === 'exit') {
          console.log(chalk.yellow('\nSaving session and exiting...'));
          await this.save();
          process.exit(0);
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
    
    // Start the next phase
    await this.runQualityPhase();
  }

  /**
   * Run the Quality Control phase
   */
  async runQualityPhase() {
    // Ensure previous phase is complete
    if (!this.phaseData[PHASES.REFINE].complete) {
      console.log(chalk.yellow("\nThe Refinement phase is not yet complete. Returning to Refinement phase..."));
      this.phase = PHASES.REFINE;
      return this.runRefinePhase();
    }
    
    // Load phase-specific framework and prompts
    const framework = await this.frameworkLoader.getPhaseFramework(PHASES.QUALITY);
    const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.QUALITY, {
      productType: this.productType,
      keywords: this.keywords,
      imageAnalysis: this.phaseData[PHASES.DRAFT].data.imageDocumentation,
      phaseHistory: `Draft iterations: ${this.phaseData[PHASES.DRAFT].data.draftStarted ? 'Yes' : 'No'}, Refinement iterations: ${this.phaseData[PHASES.REFINE].data.iterations}`
    });
    
    console.log(chalk.cyan("\n=== QUALITY CONTROL PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll finalize the review and ensure it meets all quality standards."));
    
    // Initialize quality phase if needed
    if (!this.phaseData[PHASES.QUALITY].data.qualityStarted) {
      console.log(chalk.yellow("\nPreparing for quality control..."));
      
      // Create transition message
      const transitionMessage = {
        role: 'user',
        content: "Please perform a final quality assessment of the review and apply any necessary polish."
      };
      
      this.messages.push(transitionMessage);
      this.phaseData[PHASES.QUALITY].data.qualityStarted = true;
      
      // Save session
      await this.save();
    }
    
    // Process quality phase
    let phaseComplete = false;
    
    while (!phaseComplete) {
      // Send current messages to Claude
      console.log(chalk.yellow("\nPerforming quality control..."));
      const response = await this.claude.processMessages(this.messages, systemPrompt);
      
      // Add Claude's response to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      console.log(chalk.green("\nFinal review:"));
      console.log(response.content);
      
      // Extract the final review and quality assessment
      this.phaseData[PHASES.QUALITY].data.finalReview = this.extractReviewDraft(response.content);
      this.phaseData[PHASES.QUALITY].data.qualityAssessment = this.extractQualityAssessment(response.content);
      
      // Save final review to file
      await this.saveFinalReview();
      
      // Mark phase as complete
      const { isComplete } = await inquirer.prompt([
        {
          type: 'list',
          name: 'isComplete',
          message: 'The review process is complete. What would you like to do?',
          choices: [
            { name: 'Save and finish', value: 'finish' },
            { name: 'Make final adjustments', value: 'adjust' },
            { name: 'Save and exit', value: 'exit' }
          ]
        }
      ]);
      
      if (isComplete === 'finish') {
        // Mark phase as complete
        this.phaseData[PHASES.QUALITY].complete = true;
        phaseComplete = true;
        
        console.log(chalk.green("\nReview process complete!"));
        console.log(chalk.green(`Final review saved to: ${this.getReviewFilePath()}`));
        
        // Exit the process
        process.exit(0);
      } else if (isComplete === 'adjust') {
        // Get final adjustments
        const { adjustments } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'adjustments',
            message: 'Please provide specific requests for final adjustments:',
          }
        ]);
        
        // Add adjustments to messages
        this.messages.push({
          role: 'user',
          content: adjustments
        });
      } else if (isComplete === 'exit') {
        console.log(chalk.yellow('\nSaving session and exiting...'));
        await this.save();
        process.exit(0);
      }
      
      // Save session after each interaction
      await this.save();
    }
  }

  /**
   * Save the session to a file
   */
  async save() {
    this.updatedAt = new Date().toISOString();
    
    const sessionPath = path.join(SESSION_DIR, `${this.id}.json`);
    const sessionData = this.toJSON();
    
    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
    
    if (global.VERBOSE_MODE) {
      console.log(chalk.gray(`Session saved to ${sessionPath}`));
    }
    
    return sessionPath;
  }

  /**
   * Save the final review to a markdown file
   */
  async saveFinalReview() {
    const reviewsDir = path.join(process.cwd(), 'reviews');
    await fs.mkdir(reviewsDir, { recursive: true });
    
    const reviewPath = this.getReviewFilePath();
    const reviewContent = this.phaseData[PHASES.QUALITY].data.finalReview || 
                          this.phaseData[PHASES.REFINE].data.refinedReview ||
                          this.phaseData[PHASES.DRAFT].data.reviewDraft || '';
    
    await fs.writeFile(reviewPath, reviewContent);
    
    return reviewPath;
  }

  /**
   * Get the file path for the final review
   */
  getReviewFilePath() {
    const sanitizedName = this.productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    return path.join(process.cwd(), 'reviews', `${sanitizedName}-${timestamp}.md`);
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
      phaseData: this.phaseData
    };
  