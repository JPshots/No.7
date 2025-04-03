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
const { SimplifiedResearchPlanner } = require('./simplified-research-planner');

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
    
    // Web search configuration
    this.webSearchEnabled = process.env.ENABLE_WEB_SEARCH === 'true' || false;
    
    // Initialize API clients
    this.claude = new ClaudeAPI();
    this.imageHandler = new ImageHandler(this.imageDir);
    this.frameworkLoader = new FrameworkLoader();
  }

  // ... your existing methods ...

  /**
   * Conduct product research during the Intake phase with simplified planner
   * This should be called during runIntakePhase()
   */
  async conductProductResearch() {
    if (!this.webSearchEnabled || !this.claude) {
      console.log(chalk.yellow('\nWeb search is disabled. Enable it in .env file to use research features.'));
      return false;
    }
    
    console.log(chalk.cyan('\n=== ENHANCED RESEARCH ==='));
    console.log(chalk.yellow('This feature uses web search to gather additional product information.'));
    
    // Ask if user wants to use web research
    const { useResearch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useResearch',
        message: 'Would you like to use web search to enhance your review? (Budget: $0.50)',
        default: true
      }
    ]);
    
    if (!useResearch) {
      console.log(chalk.yellow('Skipping enhanced research.'));
      return false;
    }
    
    try {
      // Initialize the simplified research planner
      const researchPlanner = new SimplifiedResearchPlanner(
        this.claude,
        this.productName,
        this.productType || 'generic'
      );
      
      // Execute the research plan
      const researchResults = await researchPlanner.executeResearch();
      
      // Save results to phase data
      this.phaseData[PHASES.INTAKE].data.researchResults = researchResults;
      
      // Format research for review
      const formattedResearch = researchPlanner.formatResearchForReview(researchResults);
      this.phaseData[PHASES.INTAKE].data.formattedResearch = formattedResearch;
      
      // Extract research insights for system prompt
      const researchInsights = this.extractResearchInsights(researchResults);
      this.phaseData[PHASES.INTAKE].data.researchInsights = researchInsights;
      
      // Generate additional questions based on research if we have gap analysis
      if (researchResults.gapAnalysis) {
        const additionalQuestions = await this.generateQuestionsFromGapAnalysis(researchResults.gapAnalysis);
        
        // Ask user if they want to answer these questions
        if (additionalQuestions.length > 0) {
          const { answerQuestions } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'answerQuestions',
              message: 'Based on research, I have some additional questions. Would you like to answer them?',
              default: true
            }
          ]);
          
          if (answerQuestions) {
            // Ask each question and add to messages
            for (const question of additionalQuestions) {
              // Add question to messages
              this.messages.push({
                role: 'assistant',
                content: question
              });
              
              // Get user's answer
              const { answer } = await inquirer.prompt([
                {
                  type: 'editor',
                  name: 'answer',
                  message: `${question}\n(An editor will open for your response)`
                }
              ]);
              
              // Add answer to messages
              this.messages.push({
                role: 'user',
                content: answer
              });
            }
          }
        }
      }
      
      console.log(chalk.green('\nResearch completed successfully!'));
      return true;
    } catch (error) {
      console.error(chalk.red('Error conducting product research:'), error.message);
      return false;
    }
  }

  /**
   * Extract research insights for system prompt
   * @param {Object} researchResults - Research results
   * @returns {Array} Research insights
   */
  extractResearchInsights(researchResults) {
    const insights = [];
    
    // Extract product research insights
    if (researchResults.productResearch && researchResults.productResearch.length > 0) {
      researchResults.productResearch.forEach(research => {
        insights.push({
          topic: research.topic,
          summary: this.summarizeContent(research.result, 3)
        });
      });
    }
    
    // Extract gap analysis insights
    if (researchResults.gapAnalysis) {
      insights.push({
        topic: "Information Gaps",
        summary: this.extractGaps(researchResults.gapAnalysis)
      });
    }
    
    return insights;
  }

  /**
   * Extract gaps from gap analysis
   * @param {string} gapAnalysis - Gap analysis content
   * @returns {Array} Extracted gaps
   */
  extractGaps(gapAnalysis) {
    // Look for bulleted or numbered lists
    const listItemRegex = /^[•*-]\s+(.+)$|^\d+\.\s+(.+)$/gm;
    const listItems = [...gapAnalysis.matchAll(listItemRegex)]
      .map(match => match[1] || match[2])
      .filter(Boolean);
    
    // If no list items found, use sentences
    if (listItems.length === 0) {
      return this.summarizeContent(gapAnalysis, 3);
    }
    
    return listItems.slice(0, 5);
  }

  /**
   * Generate questions from gap analysis
   * @param {string} gapAnalysis - Gap analysis content
   * @returns {Array} Generated questions
   */
  async generateQuestionsFromGapAnalysis(gapAnalysis) {
    try {
      console.log(chalk.cyan("\n=== GENERATING QUESTIONS FROM GAP ANALYSIS ==="));
      
      const systemPrompt = `
You are an expert product reviewer helping to create questions based on identified information gaps.
Based on the gap analysis provided, generate 2-3 targeted questions that would help fill these information gaps.
Make questions specific, direct, and easy to answer. Focus only on the most important gaps.
`;

      const messages = [
        {
          role: 'user',
          content: `Based on this gap analysis, generate 2-3 questions to fill the most important information gaps:\n\n${gapAnalysis}`
        }
      ];
      
      // Use Claude to generate questions (without web search)
      const response = await this.claude.processMessages(messages, systemPrompt, false);
      
      // Extract questions
      const questions = this.extractQuestions(response.content);
      
      // Limit to at most 3 questions
      return questions.slice(0, 3);
    } catch (error) {
      console.error(chalk.red("Error generating questions:"), error.message);
      return [];
    }
  }

  /**
   * Extract questions from text
   * @param {string} content - Text content
   * @returns {Array} Extracted questions
   */
  extractQuestions(content) {
    // Look for numbered or bulleted questions
    const questionRegex = /^[•*-]?\s*\d*\.?\s*(.+\?)$/gm;
    const questions = [...content.matchAll(questionRegex)]
      .map(match => match[1].trim())
      .filter(q => q.length > 10);
    
    // If no clear questions found, look for any sentences ending with question marks
    if (questions.length === 0) {
      const sentences = content.split(/(?<=[.!?])\s+/);
      return sentences
        .filter(s => s.trim().endsWith('?'))
        .map(s => s.trim())
        .filter(s => s.length > 10);
    }
    
    return questions;
  }
  
  /**
   * Summarize content to a limited number of points
   * @param {string} content - Content to summarize
   * @param {number} limit - Maximum number of points
   * @returns {Array} Summarized points
   */
  summarizeContent(content, limit = 5) {
    // Split content into sentences
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10)
      .slice(0, limit);
    
    return sentences;
  }

  /**
   * Update runIntakePhase to include research
   * Add this code to your existing runIntakePhase() method before transitioning to draft phase
   */
  async runIntakePhase() {
    // ... your existing code ...
    
    // After getting initial product description and images
    if (this.webSearchEnabled) {
      await this.conductProductResearch();
    }
    
    // ... your existing question-answer loop ...
    
    // ... then continue with transition to draft phase ...
  }

  /**
   * Update createSystemPrompt to include research insights
   * This method might need to be added or modified in your existing code
   */
  async createSystemPromptWithResearch(phase) {
    // Load the base system prompt
    let systemPrompt = await this.frameworkLoader.loadSystemPrompt(phase);
    
    // Add research insights if available
    if (this.phaseData[PHASES.INTAKE].data.researchInsights) {
      const insights = this.phaseData[PHASES.INTAKE].data.researchInsights;
      
      if (insights.length > 0) {
        systemPrompt += "\n\n## WEB RESEARCH INSIGHTS\n\n";
        
        insights.forEach(insight => {
          systemPrompt += `### ${insight.topic.toUpperCase()}\n\n`;
          
          if (insight.summary && insight.summary.length > 0) {
            insight.summary.forEach(point => {
              systemPrompt += `- ${point}\n`;
            });
            systemPrompt += "\n";
          }
        });
        
        // Add guidance on using research
        systemPrompt += `
IMPORTANT: Use the web research insights above to enhance the review, but:
1. Do not fabricate specific user experiences that weren't mentioned by the human
2. Use research to provide context, technical details, and comparison points
3. Blend research naturally into the review without directly copying phrases
4. Prioritize the human's actual experiences and observations over research
5. Use research primarily for filling gaps and providing additional context
`;
      }
    }
    
    return systemPrompt;
  }

  // ... rest of your Session class methods ...
}

module.exports = { Session };