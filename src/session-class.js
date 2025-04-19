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
  // Add robust error recovery to session.start()
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
    
    // Improved error recovery options
    const { recoveryAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'recoveryAction',
        message: 'An error occurred. How would you like to proceed?',
        choices: [
          { name: 'Save session and try to continue', value: 'continue' },
          { name: 'Save session and exit', value: 'exit' },
          { name: 'Try to restart the current phase', value: 'restart' },
          { name: 'Debug: Print detailed error information', value: 'debug' }
        ]
      }
    ]);
    
    // Handle recovery option
    switch (recoveryAction) {
      case 'continue':
        console.log(chalk.yellow('Attempting to continue after error...'));
        await this.save();
        return;
      case 'exit':
        console.log(chalk.yellow('Saving session and exiting...'));
        await this.save();
        process.exit(1);
      case 'restart':
        console.log(chalk.yellow(`Restarting ${this.phase} phase...`));
        await this.save();
        await this.start(); // Recursive call, be careful!
        return;
      case 'debug':
        console.log(chalk.red('===== DETAILED ERROR INFORMATION ====='));
        console.error(error);
        console.log(chalk.red('========================================'));
        console.log(chalk.yellow('Saving session and exiting...'));
        await this.save();
        process.exit(1);
    }
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
    console.log(chalk.yellow("TIP: Use 'show-framework phase.section_name' to view framework sections"));
    console.log(chalk.yellow("Example: 'show-framework draft.humor_framework'"));
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
      
      // Add intake optimization reminder for first Claude response
      if (this.messages.length <= 1) {
        console.log(chalk.gray("Adding intake optimization instructions..."));
        
        // Add an optimization message before the first Claude response
        const optimizationMessage = {
          role: 'user',
          content: `
IMPORTANT GUIDELINE: Limit your first response to 5-10 high-value questions (12 maximum).


   ESSENTIAL QUESTIONS (3-5 questions about core experience):
   • Primary usage experience and standout features
   • Major pros and cons from user perspective
   • Value assessment and overall satisfaction
   
   focused & contextual questions (2-7 questions for deeper insights):
   • Comparisons to alternatives
   • Specific usage scenarios or technical details
   • Product-specific areas of interest based on category

Keep the total question count between 5-10 (not exceeding 12), prioritizing the most valuable questions.

After receiving the user's response, ONLY ask additional questions if:
1. The user's response revealed significant new information that needs exploration
2. The user mentioned something unexpected that requires clarification
3. There's a critical information gap that wasn't apparent in the initial description

Do not arbitrarily split your questions across multiple interactions. If you have all the essential information after the user responds, move to the draft phase.

`
        };
        
        // Add the optimization message to the messages array
        this.messages.push(optimizationMessage);
      }

      // Then proceed with sending the messages to Claude
      console.log(chalk.yellow("\nProcessing your input..."));
      let response = await this.claude.processMessages(this.messages, systemPrompt);
      
      if (this.messages.length > 2) {
        // Check if this is just follow-up questions without real new insights
        const isJustFollowupQuestions = 
          response.content.includes("follow-up") &&
          !response.content.includes("Based on your response about") &&
          !response.content.includes("I notice you mentioned");
        
        if (isJustFollowupQuestions) {
          console.log(chalk.yellow("Detected unnecessary follow-up questions. Modifying response..."));
          
          // Add a message to guide Claude away from unnecessary follow-ups
          this.messages.push({
            role: 'user',
            content: `
Please consolidate your remaining questions into a single response rather than splitting them across multiple interactions. Only ask truly new questions that emerged from my previous answers, not questions you could have asked initially. If you have no genuinely new questions based on my responses, please indicate we can move to the draft phase once I've answered these questions.
            `
          });
          
          // Get a new response with the guidance
          response = await this.claude.processMessages(this.messages, systemPrompt);
        }
      }
      
      // Add Claude's response to messages
      this.messages.push({
        role: 'assistant',
        content: response.content
      });
      
      // Save session after initial setup
      await this.save();
    }
    
    // Process intake phase until complete
    let phaseComplete = false;
    
    while (!phaseComplete) {
      // Send current messages to Claude
      console.log(chalk.yellow("\nProcessing your input..."));
      let response = await this.claude.processMessages(this.messages, systemPrompt);

      if (this.messages.length > 2) {
        // Check if this is just follow-up questions without real new insights
        const isJustFollowupQuestions = 
          response.content.includes("follow-up") &&
          !response.content.includes("Based on your response about") &&
          !response.content.includes("I notice you mentioned");
        
        if (isJustFollowupQuestions) {
          console.log(chalk.yellow("Detected unnecessary follow-up questions. Modifying response..."));
          
          // Add a message to guide Claude away from unnecessary follow-ups
          this.messages.push({
            role: 'user',
            content: `
Please consolidate your remaining questions into a single response rather than splitting them across multiple interactions. Only ask truly new questions that emerged from my previous answers, not questions you could have asked initially. If you have no genuinely new questions based on my responses, please indicate we can move to the draft phase once I've answered these questions.
            `
          });
          
          // Get a new response with the guidance
          response = await this.claude.processMessages(this.messages, systemPrompt);
        }
      }
      
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
        } else if (userResponse.trim().toLowerCase().startsWith('show-framework ')) {
          // Handle framework section viewing
          const command = userResponse.trim().replace('show-framework ', '');
          await this.showFrameworkSection(command);
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
    this.phaseData[PHASES.DRAFT].data.framework = framework;
    console.log(chalk.gray("Draft framework stored in session data for reference in later phases"));
    const systemPrompt = await this.frameworkLoader.createDynamicPrompt(PHASES.DRAFT, {
      productType: this.productType,
      keywords: this.keywords
    });
    
    console.log(chalk.cyan("\n=== DRAFT CREATION PHASE ==="));
    console.log(chalk.yellow("In this phase, I'll create a complete review draft based on the information gathered."));
    console.log(chalk.yellow("TIP: Use 'show-framework phase.section_name' to view framework sections"));
    console.log(chalk.yellow("Example: 'show-framework draft.humor_framework'"));

    // Extract relevant information for draft creation
    if (!this.phaseData[PHASES.DRAFT].data.draftStarted) {
      console.log(chalk.yellow("\nPreparing to create draft..."));
      
      // Create transition message
      const transitionMessage = {
        role: 'user',
        content: "I'm ready to move to the draft creation phase. Please create a complete review draft based on the information I've provided."
      };
      this.messages.push(transitionMessage);

      // Add explicit personality planning message
      const personalityPlanningMessage = {
        role: 'user',
        content: `IMPORTANT: Include a distinct personality and appropriate humor in your first draft response.

      Use your judgment to determine which humor and personality approaches work best for this product, but ensure the review has:

      - A consistent, engaging voice throughout
      - Creative elements that make the review memorable
      - Personality that enhances rather than distracts from the product information

      Your first response should be a complete draft with personality fully integrated - don't save personality for a later revision.`
      };
      this.messages.push(personalityPlanningMessage);

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
    console.log(chalk.yellow("TIP: Use 'show-framework phase.section_name' to view framework sections"));
    console.log(chalk.yellow("Example: 'show-framework draft.humor_framework'"));

    // Check if draft framework is stored in session data
    if (this.phaseData[PHASES.DRAFT].data.framework) {
      console.log(chalk.green("Draft framework is available from previous phase"));
    } else {
      // Load draft framework for reference
      try {
        await this.frameworkLoader.loadPhaseFramework('draft');
        console.log(chalk.green("Draft framework loaded for reference"));
      } catch (error) {
        console.log(chalk.yellow("Note: Could not load draft framework: " + error.message));
      }
    }

    // Prompt user for feedback
    const { userFeedback } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'userFeedback',
        message: 'Please provide your feedback on the draft (an editor will open):'
      }
    ]);

    // Handle special commands
    if (userFeedback.trim().toLowerCase() === 'exit') {
      console.log(chalk.yellow('\nSaving session and exiting...'));
      await this.save();
      process.exit(0);
    } else if (userFeedback.trim().toLowerCase() === 'save') {
      await this.save();
      console.log(chalk.green('\nSession saved successfully!'));
      return;
    } else if (userFeedback.trim().toLowerCase().startsWith('show-framework ')) {
      // Handle framework section viewing
      const command = userFeedback.trim().replace('show-framework ', '');
      await this.showFrameworkSection(command);
      return;
    }

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
    if (!this.id) {
      console.error(chalk.red('Error: Cannot save session - missing session ID'));
      throw new Error('Invalid session: missing ID');
    }
    try {
      this.updatedAt = new Date().toISOString();
      
      // Get absolute path to session directory for clearer logging
      const absoluteSessionDir = path.resolve(SESSION_DIR);
      console.log(chalk.gray(`Session directory (absolute): ${absoluteSessionDir}`));
      
      // Ensure session directory exists
      try {
        await fs.mkdir(absoluteSessionDir, { recursive: true });
        console.log(chalk.gray(`Session directory created/verified at: ${absoluteSessionDir}`));
      } catch (dirError) {
        console.error(chalk.red(`Error creating sessions directory:`), dirError.message);
        throw dirError;
      }
      
      // Create session file path and prepare data
      const sessionPath = path.join(absoluteSessionDir, `${this.id}.json`);
      const sessionData = this.toJSON();
      
      // Add sanity check for session data
      if (!sessionData || !sessionData.id) {
        console.error(chalk.red(`Invalid session data! ID missing from session data.`));
        console.dir(sessionData, { depth: 1 });
        throw new Error('Invalid session data detected');
      }
      
      // Save with debug info
      console.log(chalk.gray(`Saving session ${this.id} to ${sessionPath}`));
      const jsonData = JSON.stringify(sessionData, null, 2);
      console.log(chalk.gray(`Prepared ${jsonData.length} bytes of JSON data`));
      
      // Add backup before overwriting
      try {
        const backupPath = path.join(absoluteSessionDir, `${this.id}.backup.json`);
        await fs.access(sessionPath);
        // File exists, create backup
        await fs.copyFile(sessionPath, backupPath);
        console.log(chalk.gray(`Backup created at: ${backupPath}`));
      } catch (error) {
        // No existing file to back up or backup failed
        console.log(chalk.gray(`No existing session file to backup`));
      }
      
      // Write file
      await fs.writeFile(sessionPath, jsonData);
      
      // Verify file was written
      try {
        // Verify file exists and is readable
        await fs.access(sessionPath, fs.constants.R_OK | fs.constants.W_OK);
        const stats = await fs.stat(sessionPath);
        if (stats.size === 0) {
          throw new Error('Empty file after save');
        }
        console.log(chalk.green(`Session saved successfully: ${this.id} (${stats.size} bytes)`));
      } catch (error) {
        console.error(chalk.red(`Failed to verify saved file: ${error.message}`));
        throw new Error(`Session save verification failed: ${error.message}`);
      }
    } catch (error) {
      console.error(chalk.red('Error saving session:'), error.message);
      throw error;
    }
  }

  /**
   * Run the Quality Control phase
   */
  async runQualityPhase() {
    // Add this to the beginning of runQualityPhase()
if (!this.phaseData[PHASES.REFINE].complete && !this.phaseData[PHASES.DRAFT].complete) {
  console.log(chalk.yellow("\nNeither Draft nor Refinement phase is marked as complete."));
  console.log(chalk.yellow("Please complete at least one of these phases before quality control."));
  
  // Ask user which phase to return to
  const { returnPhase } = await inquirer.prompt([
    {
      type: 'list',
      name: 'returnPhase',
      message: 'Which phase would you like to return to?',
      choices: [
        { name: 'Draft Creation', value: PHASES.DRAFT },
        { name: 'Refinement', value: PHASES.REFINE }
      ]
    }
  ]);
  
  this.phase = returnPhase;
  if (returnPhase === PHASES.DRAFT) {
    return this.runDraftPhase();
  } else {
    return this.runRefinePhase();
  }
}
    try {
      console.log(chalk.cyan("\n=== QUALITY CONTROL PHASE ==="));
      console.log(chalk.yellow("In this phase, I'll finalize the review and ensure it meets all quality standards."));
      console.log(chalk.yellow("TIP: Use 'show-framework phase.section_name' to view framework sections"));
      console.log(chalk.yellow("Example: 'show-framework draft.humor_framework'"));

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
// After getting Claude's response for quality assessment
console.log(chalk.green("\nQuality Assessment:"));
console.log(response.content);

// Save assessment to session data
this.phaseData[PHASES.QUALITY].data.qualityAssessment = response.content;

// Add an explicit pause to review the quality assessment
const { reviewAssessment } = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'reviewAssessment',
    message: 'Would you like to make additional refinements based on this assessment?',
    default: false
  }
]);

if (reviewAssessment) {
  console.log(chalk.yellow("\nMoving back to refinement phase for final adjustments..."));
  this.phase = PHASES.REFINE;
  
  // Add a message to indicate this is a quality-based refinement
  this.messages.push({
    role: 'user',
    content: "I'd like to make some final refinements based on the quality assessment. Please help me implement these improvements while maintaining the review's core structure and personality."
  });
  
  await this.save();
  return this.runRefinePhase();
}
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
      // Add this after the quality assessment section in runQualityPhase()
// Inside the existing try/catch block, before the finally block

// Format the final review for display with better spacing
const formattedReview = reviewContent.split('\n').join('\n');
console.log(chalk.cyan("\n=== FINAL REVIEW ===\n"));
console.log(formattedReview);

// Save the final review with additional metadata
const reviewMetadata = {
  productName: this.productName,
  productType: this.productType || 'general',
  createdAt: this.createdAt,
  completedAt: new Date().toISOString(),
  keywords: this.keywords || [],
  qualityScore: extractQualityScore(this.phaseData[PHASES.QUALITY].data.qualityAssessment || ''),
  finalReviewPath: filePath
};

// Save metadata alongside review
const metadataPath = path.join(reviewsDir, `${sanitizedName}-${date}.json`);
try {
  await fs.writeFile(metadataPath, JSON.stringify(reviewMetadata, null, 2));
  console.log(chalk.green(`Review metadata saved to: ${metadataPath}`));
} catch (metadataError) {
  console.error(chalk.yellow(`Warning: Could not save review metadata: ${metadataError.message}`));
}
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
      const absoluteSessionDir = path.resolve(SESSION_DIR);
      console.log(chalk.gray(`Looking for sessions in: ${absoluteSessionDir}`));
      
      // Ensure session directory exists
      try {
        await fs.mkdir(absoluteSessionDir, { recursive: true });
        console.log(chalk.gray(`Session directory created/verified`));
      } catch (dirError) {
        console.error(chalk.red(`Error accessing session directory:`), dirError.message);
        return [];
      }
      
      // Read all files in session directory
      let files;
      try {
        files = await fs.readdir(absoluteSessionDir);
        console.log(chalk.gray(`Found ${files.length} files in sessions directory`));
      } catch (readError) {
        console.error(chalk.red(`Error reading session directory:`), readError.message);
        return [];
      }
      
      // Filter for JSON files (excluding backups)
      const sessionFiles = files.filter(file => 
        path.extname(file) === '.json' && !file.includes('.backup.')
      );
      console.log(chalk.gray(`Found ${sessionFiles.length} JSON session files`));
      
      // Load each session
      const sessions = [];
      let loadedCount = 0;
      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(absoluteSessionDir, file);
          const fileContents = await fs.readFile(sessionPath, 'utf8');
          
          // Validate JSON before parsing
          try {
            const sessionData = JSON.parse(fileContents);
            // Verify it has required fields
            if (sessionData && sessionData.id && sessionData.phase) {
              sessions.push(sessionData);
              loadedCount++;
            } else {
              console.warn(chalk.yellow(`Warning: Session file ${file} is missing required fields`));
            }
          } catch (jsonError) {
            console.error(chalk.yellow(`Warning: Invalid JSON in session file ${file}`), jsonError.message);
            
            // Try to recover from backup if available
            try {
              const backupPath = path.join(absoluteSessionDir, file.replace('.json', '.backup.json'));
              await fs.access(backupPath);
              console.log(chalk.yellow(`Attempting recovery from backup for ${file}`));
              const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
              if (backupData && backupData.id) {
                sessions.push(backupData);
                loadedCount++;
                console.log(chalk.green(`Successfully recovered session from backup: ${backupData.id}`));
              }
            } catch (recoveryError) {
              console.log(chalk.yellow(`No backup available or recovery failed for ${file}`));
            }
          }
        } catch (error) {
          console.error(chalk.yellow(`Warning: Could not load session file ${file}:`), error.message);
        }
      }
      
      console.log(chalk.green(`Successfully loaded ${loadedCount} of ${sessionFiles.length} session files`));
      
      // Sort by updated date (newest first)
      const sorted = sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      console.log(chalk.gray(`Sorted ${sorted.length} sessions by updated date`));
      
      return sorted;
    } catch (error) {
      console.error(chalk.red('Error getting all sessions:'), error.message);
      return [];
    }
  }

  static async recoverMissingSession(productName) {
    console.log(chalk.yellow(`Attempting to recover session for: ${productName}`));
    
    try {
      const absoluteSessionDir = path.resolve(SESSION_DIR);
      const files = await fs.readdir(absoluteSessionDir);
      const sessionFiles = files.filter(file => path.extname(file) === '.json');
      
      // Search in all session files
      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(absoluteSessionDir, file);
          const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
          
          // Check if this session matches the product name (case insensitive)
          if (sessionData.productName && 
              sessionData.productName.toLowerCase().includes(productName.toLowerCase())) {
            console.log(chalk.green(`Found matching session: ${sessionData.id} - ${sessionData.productName}`));
            return sessionData;
          }
        } catch (error) {
          continue; // Skip problematic files
        }
      }
      
      console.log(chalk.yellow(`No matching session found for product: ${productName}`));
      return null;
    } catch (error) {
      console.error(chalk.red(`Recovery error:`), error.message);
      return null;
    }
  }

  /**
   * Extract review content from Claude's response more accurately
   * @param {string} content - Claude's response content
   * @returns {string} Extracted review content
   */
  extractReviewContent(content) {
    // First look for content between markdown code blocks
    const markdownMatch = content.match(/```(?:markdown)?\s*([\s\S]+?)\s*```/);
    if (markdownMatch) return markdownMatch[1].trim();
    
    // Next, look for sections that appear to be a review with headers
    const headerPattern = /(^|\n)## .+/g;
    if (content.match(headerPattern)) {
      // Find where the review starts (first heading)
      const firstHeaderMatch = content.match(/(^|\n)(# |## ).+/);
      if (firstHeaderMatch) {
        const startIndex = firstHeaderMatch.index;
        // Extract from first heading to end (or before any "In conclusion" type text)
        const endMarkers = [
          "\n\nI hope this review",
          "\n\nLet me know if",
          "\n\nIs there anything"
        ];
        
        let endIndex = content.length;
        for (const marker of endMarkers) {
          const markerIndex = content.indexOf(marker);
          if (markerIndex !== -1 && markerIndex < endIndex) {
            endIndex = markerIndex;
          }
        }
        
        return content.substring(startIndex, endIndex).trim();
      }
    }
    
    // Look for sections that might be the review based on keywords
    const reviewKeywords = ['PROS', 'CONS', 'VERDICT', 'REVIEW', 'RATING'];
    const paragraphs = content.split(/\n{2,}/);
    
    // Find the longest section containing review keywords
    const reviewSection = paragraphs.reduce((longest, paragraph) => {
      const hasKeywords = reviewKeywords.some(keyword => 
        paragraph.toUpperCase().includes(keyword)
      );
      
      if (hasKeywords && paragraph.length > longest.length) {
        return paragraph;
      }
      return longest;
    }, '');
    
    if (reviewSection && reviewSection.length > 100) {
      return reviewSection;
    }
    
    // If all else fails, look for the longest paragraph
    const longestParagraph = paragraphs.reduce((longest, paragraph) => 
      paragraph.length > longest.length ? paragraph : longest, '');
    
    // If the longest paragraph is substantial, it might be part of the review
    if (longestParagraph && longestParagraph.length > 200) {
      return longestParagraph;
    }
    
    // If no clear review section, return the whole content
    return content;
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
}

/**
 * Access framework section and display it
 * @param {string} command - Command in format "phase.section_path"
 * @returns {Promise<boolean>} - Success status
 */
Session.prototype.showFrameworkSection = async function(command) {
  try {
    // Parse command
    const parts = command.split('.');
    if (parts.length < 2) {
      console.log(chalk.yellow("Invalid format. Use 'show-framework phase.section_path' (e.g., 'show-framework draft.humor_framework')"));
      return false;
    }
    
    const phase = parts[0];
    const sectionPath = parts.slice(1).join('.');
    
    console.log(chalk.yellow(`Accessing ${phase} framework section: ${sectionPath}`));
    
    // Get section content
    const section = await this.frameworkLoader.getFrameworkSection(phase, sectionPath);
    
    if (section) {
      console.log(chalk.green(`\n${phase.toUpperCase()}.${sectionPath.toUpperCase()}`));
      console.log(JSON.stringify(section, null, 2));
      return true;
    } else {
      console.log(chalk.red(`Section not found: ${phase}.${sectionPath}`));
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`Error processing framework section command:`), error.message);
    return false;
  }
};
/**
 * Extract quality score from assessment text
 * @param {string} assessmentText - Quality assessment text
 * @returns {Object|null} Extracted scores or null if not found
 */
function extractQualityScore(assessmentText) {
  const scores = {};
  
  // Look for overall score
  const totalScoreMatch = assessmentText.match(/Total Score:\s*(\d+)\/100/i) || 
                           assessmentText.match(/Overall.+?(\d+)\/100/i);
  
  if (totalScoreMatch) {
    scores.total = parseInt(totalScoreMatch[1]);
  }
  
  // Look for category scores
  const categories = ['Testing Depth', 'Information Quality', 'Authenticity', 
                     'Writing Quality', 'Helpfulness'];
  
  categories.forEach(category => {
    const categoryRegex = new RegExp(`${category}\\D+(\\d+)\/20`, 'i');
    const match = assessmentText.match(categoryRegex);
    
    if (match) {
      // Convert category name to camelCase for the object
      const key = category.replace(/\s(.)/g, function($1) { return $1.toUpperCase(); })
                          .replace(/\s/g, '')
                          .replace(/^(.)/, function($1) { return $1.toLowerCase(); });
      
      scores[key] = parseInt(match[1]);
    }
  });
  
  // Only return if we found something
  return Object.keys(scores).length > 0 ? scores : null;
}

module.exports = { Session };
