/**
 * CLI Utilities
 * Provides functions for managing the CLI interface and sessions
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { Session } = require('./session');

// Session directory
const SESSION_DIR = path.join(process.cwd(), '.sessions');

/**
 * List all saved sessions
 */
async function listSessions() {
  console.log(chalk.cyan('\nSaved Review Sessions:'));
  
  try {
    // Ensure session directory exists
    await fs.mkdir(SESSION_DIR, { recursive: true });
    
    // Read all session files
    const sessions = await Session.getAllSessions();
    
    if (sessions.length === 0) {
      console.log(chalk.yellow('  No saved sessions found.'));
      return;
    }
    
    // Display sessions
    sessions.forEach((session, index) => {
      const phaseStatus = getPhaseStatusEmoji(session);
      const createdDate = new Date(session.createdAt).toLocaleString();
      const updatedDate = new Date(session.updatedAt).toLocaleString();
      
      console.log(chalk.green(`\n[${index + 1}] ${session.productName}`));
      console.log(chalk.yellow(`  ID: ${session.id}`));
      console.log(chalk.yellow(`  Phase: ${session.phase.toUpperCase()} ${phaseStatus}`));
      console.log(chalk.yellow(`  Created: ${createdDate}`));
      console.log(chalk.yellow(`  Last updated: ${updatedDate}`));
    });
  } catch (error) {
    console.error(chalk.red('Error listing sessions:'), error.message);
  }
}

/**
 * Create a new review session
 * @param {string} imageDir - Directory containing product images
 * @returns {Session} New session instance
 */
async function createNewSession(imageDir = './images') {
  console.log(chalk.cyan('\nCreating new review session...'));
  
  // Ensure session directory exists
  await fs.mkdir(SESSION_DIR, { recursive: true });
  
  // Ensure images directory exists
  await fs.mkdir(imageDir, { recursive: true });
  
  // Create new session
  const session = new Session({ imageDir });
  
  // Save the session
  await session.save();
  
  console.log(chalk.green(`New session created with ID: ${session.id}`));
  
  return session;
}

/**
 * Load an existing review session
 * @param {string} sessionId - Session ID to load
 * @returns {Session|null} Loaded session or null if not found
 */
async function loadExistingSession(sessionId) {
  console.log(chalk.cyan(`\nLoading session: ${sessionId}`));
  
  try {
    // Ensure session directory exists
    await fs.mkdir(SESSION_DIR, { recursive: true });
    
    // Read session file
    const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    // Create session from data
    const session = new Session(sessionData);
    
    console.log(chalk.green(`Loaded session for product: ${session.productName}`));
    console.log(chalk.green(`Current phase: ${session.phase.toUpperCase()}`));
    
    return session;
  } catch (error) {
    console.error(chalk.red(`Error loading session ${sessionId}:`), error.message);
    return null;
  }
}

/**
 * Get emoji representing phase status
 * @param {Object} session - Session object
 * @returns {string} Emoji representing phase status
 */
function getPhaseStatusEmoji(session) {
  const phases = ['intake', 'draft', 'refine', 'quality'];
  const currentPhaseIndex = phases.indexOf(session.phase);
  
  let status = '';
  for (let i = 0; i < phases.length; i++) {
    if (i < currentPhaseIndex) {
      // Completed phase
      status += '✅ ';
    } else if (i === currentPhaseIndex) {
      // Current phase
      if (session.phaseData[phases[i]].complete) {
        status += '✅ ';
      } else {
        status += '🔄 ';
      }
    } else {
      // Future phase
      status += '⏳ ';
    }
  }
  
  return status;
}

/**
 * Check if a session exists
 * @param {string} sessionId - Session ID to check
 * @returns {Promise<boolean>} True if session exists
 */
async function sessionExists(sessionId) {
  try {
    const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);
    await fs.access(sessionPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<boolean>} True if deletion was successful
 */
async function deleteSession(sessionId) {
  try {
    const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);
    await fs.unlink(sessionPath);
    return true;
  } catch (error) {
    console.error(chalk.red(`Error deleting session ${sessionId}:`), error.message);
    return false;
  }
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(chalk.cyan('\nAmazon Review Framework CLI Help:'));
  console.log(chalk.yellow('\nCommands:'));
  console.log(chalk.green('  --new, -n') + '                Start a new review session');
  console.log(chalk.green('  --continue <id>, -c <id>') + ' Continue an existing review session');
  console.log(chalk.green('  --list, -l') + '               List all saved review sessions');
  console.log(chalk.green('  --directory <path>, -d <path>') + ' Set custom directory for images (default: ./images)');
  console.log(chalk.green('  --verbose, -v') + '            Enable verbose output for debugging');
  console.log(chalk.green('  --help, -h') + '               Display this help information');
  
  console.log(chalk.yellow('\nUsage examples:'));
  console.log(chalk.green('  node amazon-review.js --new'));
  console.log(chalk.green('  node amazon-review.js --continue abc123'));
  console.log(chalk.green('  node amazon-review.js --list'));
  console.log(chalk.green('  node amazon-review.js --new --directory ./my-images'));
  
  console.log(chalk.yellow('\nInteractive commands (while in a session):'));
  console.log(chalk.green('  exit') + '     Save session and exit');
  console.log(chalk.green('  save') + '     Save current session state');
  console.log(chalk.green('  help') + '     Display help for current phase');
}

/**
 * Get missing methods from Session class and add them to exports
 */

/**
 * Get all saved sessions
 * @returns {Promise<Array>} Array of session objects
 */
Session.getAllSessions = async function() {
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
};

/**
 * Extract product name from description
 * @param {string} description - Product description
 * @returns {string} Extracted product name
 */
Session.prototype.extractProductName = async function(description) {
  // Look for product name in first few sentences
  // This is a simple implementation - in a full version, 
  // we could use Claude to extract the product name accurately
  
  const sentences = description.split(/[.!?]\s+/);
  const firstSentence = sentences[0] || '';
  
  // Look for product names in quotes or mentions of "product", "item", etc.
  const quoteMatch = firstSentence.match(/"([^"]+)"/);
  if (quoteMatch) return quoteMatch[1];
  
  const productMatch = firstSentence.match(/\b(product|item|device|tool|gadget)\b: ([^.!?]+)/i);
  if (productMatch) return productMatch[2];
  
  // Default to first few words if no clear product name
  const words = firstSentence.split(/\s+/);
  return words.slice(0, 3).join(' ') || 'Unnamed Product';
};

/**
 * Extract keywords from messages
 * @param {Array} messages - Array of message objects
 * @returns {Array} Extracted keywords
 */
Session.prototype.extractKeywords = function(messages) {
  // Simple implementation - in a full version,
  // we would analyze Claude's responses to identify keywords
  return [];
};

/**
 * Determine product type from messages
 * @param {Array} messages - Array of message objects
 * @returns {string} Product type
 */
Session.prototype.determineProductType = function(messages) {
  // Simple implementation - in a full version,
  // we would analyze messages to determine product type
  return 'generic';
};

/**
 * Check if a phase is complete based on Claude's response
 * @param {string} content - Claude's response content
 * @param {string} phase - Current phase
 * @returns {boolean} True if phase is complete
 */
Session.prototype.checkPhaseCompletion = function(content, phase) {
  // Look for phase completion indicators in Claude's response
  
  const completionIndicators = {
    intake: [
      'we have gathered sufficient information',
      'ready to move to the draft creation phase',
      'we can now proceed to the draft phase',
      'I have all the information I need'
    ],
    draft: [
      'complete review draft is ready',
      'the draft is now ready for your feedback',
      'here is the completed review draft',
      'ready for your evaluation and feedback'
    ],
    refine: [
      'refinements are complete',
      'final refined version of your review',
      'the review is now ready for quality control',
      'all your requested changes have been implemented'
    ],
    quality: [
      'final review is complete',
      'the review is now ready for submission',
      'review passes all quality checks',
      'quality assessment complete'
    ]
  };
  
  // Check if any completion indicators are present
  const indicators = completionIndicators[phase] || [];
  return indicators.some(indicator => 
    content.toLowerCase().includes(indicator.toLowerCase())
  );
};

/**
 * Extract review draft from Claude's response
 * @param {string} content - Claude's response content
 * @returns {string} Extracted review draft
 */
Session.prototype.extractReviewDraft = function(content) {
  // This is a simple implementation - in a full version,
  // we would use more sophisticated extraction
  
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
};

/**
 * Extract image analysis from messages
 * @param {Array} messages - Array of message objects
 * @returns {Array} Extracted image analysis
 */
Session.prototype.extractImageAnalysis = function(messages) {
  // Simple implementation - in a full version,
  // we would analyze Claude's responses about images
  return [];
};

/**
 * Extract quality assessment from Claude's response
 * @param {string} content - Claude's response content
 * @returns {Object} Quality assessment data
 */
Session.prototype.extractQualityAssessment = function(content) {
  // Simple implementation - in a full version,
  // we would extract detailed quality assessment
  return { score: 0 };
};

// Export functions
module.exports = {
  listSessions,
  createNewSession,
  loadExistingSession,
  sessionExists,
  deleteSession,
  displayHelp
};
