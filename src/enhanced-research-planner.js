/**
 * Enhanced Research Planner
 * Implements a dynamic allocation strategy with product-specific research prioritization
 */

const chalk = require('chalk');
const inquirer = require('inquirer');

class EnhancedResearchPlanner {
  /**
   * Create a new EnhancedResearchPlanner
   * @param {ClaudeAPI} claudeApi - Claude API instance
   * @param {string} productName - Product name
   * @param {string} productType - Product type
   * @param {string} importance - Research importance (low, medium, high)
   */
  constructor(claudeApi, productName, productType, importance = 'medium') {
    this.claudeApi = claudeApi;
    this.productName = productName;
    this.productType = productType;
    this.importance = importance;
    this.budgetManager = claudeApi.budgetManager;
    
    // Enhanced budget allocation with dynamic distribution
    this.researchPhases = {
      basicInfo: {
        name: "Basic product information",
        description: "Essential product details and specifications",
        minimumAllocation: 0.15, // Minimum 15% of budget
        priority: 10
      },
      gapAnalysis: {
        name: "Information gap analysis",
        description: "Identifying missing information needed for a complete review",
        minimumAllocation: 0.10, // Minimum 10% of budget 
        priority: 8
      },
      deepDive: {
        name: "Product-specific deep dive",
        description: "Specialized research based on product type",
        minimumAllocation: 0.20, // Minimum 20% of budget
        priority: 6
      },
      userExperiences: {
        name: "User experiences and common issues",
        description: "Real-world usage reports and common problems",
        minimumAllocation: 0.10, // Minimum 10% of budget
        priority: 5
      },
      alternatives: {
        name: "Competitive alternatives",
        description: "Similar products and competitive comparisons",
        minimumAllocation: 0.10, // Minimum 10% of budget
        priority: 4
      }
    };
  }

  /**
   * Generate research plan based on product type and importance
   * @returns {Object} Research plan
   */
  generateResearchPlan() {
    // Get total budget
    const totalBudget = this.budgetManager.budgetUSD;
    
    // Adjust phase priorities based on product type
    this.adjustPrioritiesByProductType();
    
    // Adjust phase priorities based on importance
    this.adjustPrioritiesByImportance();
    
    // Allocate budget based on adjusted priorities
    const allocations = this.allocateBudget(totalBudget);
    
    // Build final plan
    const plan = {
      totalBudget: totalBudget,
      productType: this.productType,
      importance: this.importance,
      phases: []
    };
    
    // Add enabled phases to the plan
    for (const [phase, details] of Object.entries(this.researchPhases)) {
      if (allocations[phase] > 0) {
        plan.phases.push({
          name: details.name,
          phase: phase,
          budget: allocations[phase],
          priority: details.priority,
          enabled: true,
          description: details.description
        });
      }
    }
    
    // Sort phases by priority
    plan.phases.sort((a, b) => b.priority - a.priority);
    
    return plan;
  }

  /**
   * Adjust research priorities based on product type
   */
  adjustPrioritiesByProductType() {
    // Reset to base priorities before adjusting
    this.researchPhases.basicInfo.priority = 10;
    this.researchPhases.gapAnalysis.priority = 8;
    this.researchPhases.deepDive.priority = 6;
    this.researchPhases.userExperiences.priority = 5;
    this.researchPhases.alternatives.priority = 4;
    
    // Product type specific adjustments
    switch (this.productType.toLowerCase()) {
      case 'electronics':
        this.researchPhases.deepDive.priority += 3; // Technical specs are critical
        this.researchPhases.alternatives.priority += 2; // Comparisons are important
        this.researchPhases.deepDive.name = "Technical specifications and compatibility";
        break;
        
      case 'kitchen':
        this.researchPhases.userExperiences.priority += 3; // Real usage is key
        this.researchPhases.deepDive.name = "Materials safety and durability";
        break;
        
      case 'clothing':
        this.researchPhases.deepDive.priority += 2;
        this.researchPhases.deepDive.name = "Sizing accuracy and materials";
        this.researchPhases.userExperiences.priority += 2; // Fit experiences matter
        break;
        
      case 'beauty':
        this.researchPhases.deepDive.priority += 3;
        this.researchPhases.deepDive.name = "Ingredients analysis and skin compatibility";
        this.researchPhases.userExperiences.priority += 2; // Results are subjective
        break;
        
      case 'tool':
        this.researchPhases.deepDive.priority += 2;
        this.researchPhases.deepDive.name = "Durability and professional usage";
        this.researchPhases.alternatives.priority += 1;
        break;
        
      case 'toy':
        this.researchPhases.deepDive.priority += 3;
        this.researchPhases.deepDive.name = "Safety considerations and age appropriateness";
        this.researchPhases.userExperiences.priority += 1;
        break;
        
      case 'book':
        this.researchPhases.deepDive.priority += 2;
        this.researchPhases.deepDive.name = "Author background and critical reception";
        this.researchPhases.alternatives.priority += 2; // Similar works matter
        break;
        
      case 'software':
        this.researchPhases.deepDive.priority += 3;
        this.researchPhases.deepDive.name = "System requirements and compatibility";
        this.researchPhases.userExperiences.priority += 2; // Bug reports matter
        this.researchPhases.alternatives.priority += 2; // Alternative software
        break;
        
      default:
        // No special adjustments for generic products
        this.researchPhases.deepDive.name = "Product-specific analysis";
        break;
    }
  }

  /**
   * Adjust research priorities based on importance
   */
  adjustPrioritiesByImportance() {
    switch (this.importance) {
      case 'low':
        // For low importance, emphasize just getting the basics
        this.researchPhases.basicInfo.priority += 2;
        this.researchPhases.gapAnalysis.priority -= 2;
        this.researchPhases.alternatives.priority -= 1;
        break;
        
      case 'high':
        // For high importance, aim for comprehensive research
        this.researchPhases.gapAnalysis.priority += 1;
        this.researchPhases.deepDive.priority += 1;
        this.researchPhases.userExperiences.priority += 1;
        this.researchPhases.alternatives.priority += 1;
        break;
        
      case 'medium':
      default:
        // Medium importance uses the base priorities with product type adjustments
        break;
    }
  }

  /**
   * Allocate budget based on priorities
   * @param {number} totalBudget - Total budget in USD
   * @returns {Object} Budget allocations
   */
  allocateBudget(totalBudget) {
    // Initialize allocations
    const allocations = {};
    for (const phase in this.researchPhases) {
      allocations[phase] = 0;
    }
    
    // Calculate total priority points
    let totalPriority = 0;
    for (const phase in this.researchPhases) {
      totalPriority += this.researchPhases[phase].priority;
    }
    
    // Allocate budget proportionally to priorities
    let remainingBudget = totalBudget;
    
    // First, allocate minimum budgets
    for (const phase in this.researchPhases) {
      const minAllocation = this.researchPhases[phase].minimumAllocation * totalBudget;
      
      // Only allocate if the phase has a non-zero priority
      if (this.researchPhases[phase].priority > 0) {
        allocations[phase] = minAllocation;
        remainingBudget -= minAllocation;
      }
    }
    
    // If we have budget left, distribute it based on priority
    if (remainingBudget > 0 && totalPriority > 0) {
      for (const phase in this.researchPhases) {
        const proportionalShare = (this.researchPhases[phase].priority / totalPriority) * remainingBudget;
        allocations[phase] += proportionalShare;
      }
    }
    
    // For low importance, we may disable some phases completely
    if (this.importance === 'low') {
      // Keep only the top 3 phases by priority
      const phasesByPriority = Object.entries(this.researchPhases)
        .sort((a, b) => b[1].priority - a[1].priority);
      
      // Zero out budget for lower priority phases
      for (let i = 3; i < phasesByPriority.length; i++) {
        const phaseName = phasesByPriority[i][0];
        // Redistribute this budget to the top phase
        allocations[phasesByPriority[0][0]] += allocations[phaseName];
        allocations[phaseName] = 0;
      }
    }
    
    // Round allocations to 2 decimal places
    for (const phase in allocations) {
      allocations[phase] = Math.round(allocations[phase] * 100) / 100;
    }
    
    return allocations;
  }

  /**
   * Execute research according to the plan
   * @returns {Object} Research results
   */
  async executeResearch() {
    const results = {
      basicInfo: null,
      gapAnalysis: null,
      deepDive: null,
      userExperiences: null,
      alternatives: null
    };
    
    // Generate the research plan
    const plan = this.generateResearchPlan();
    
    console.log(chalk.cyan("\n=== ENHANCED RESEARCH PLAN ==="));
    console.log(chalk.yellow(`Product type: ${this.productType} | Importance: ${this.importance}`));
    console.log(chalk.yellow(`Total research budget: $${this.budgetManager.budgetUSD.toFixed(2)}`));
    console.log(chalk.cyan("\nResearch phases:"));
    
    plan.phases.forEach(phase => {
      console.log(chalk.yellow(`- ${phase.name}: $${phase.budget.toFixed(2)}`));
    });
    
    // Execute each enabled research phase in priority order
    for (const phase of plan.phases) {
      // Check if we have budget remaining
      if (this.budgetManager.budgetExhausted) {
        console.log(chalk.yellow("\nResearch budget exhausted. Skipping remaining phases."));
        break;
      }
      
      console.log(chalk.cyan(`\n=== RESEARCHING: ${phase.name.toUpperCase()} ===`));
      console.log(chalk.gray(phase.description));
      
      try {
        let response;
        switch (phase.phase) {
          case 'basicInfo':
            response = await this.claudeApi.performResearch(
              `Essential information about ${this.productName} including specifications, features, and intended use`,
              this.productName
            );
            results.basicInfo = response.content;
            break;
            
          case 'gapAnalysis':
            // We need some initial data before we can do gap analysis
            const currentInsights = [];
            if (results.basicInfo) {
              currentInsights.push(`Basic product information collected`);
            }
            
            response = await this.claudeApi.analyzeProductGaps(
              this.productName,
              this.productType,
              currentInsights
            );
            results.gapAnalysis = response.content;
            break;
            
          case 'deepDive':
            response = await this.claudeApi.performResearch(
              phase.name + " for " + this.productName,
              this.productName
            );
            results.deepDive = response.content;
            break;
            
          case 'userExperiences':
            response = await this.claudeApi.performResearch(
              `Common user experiences, feedback, and issues with ${this.productName}`,
              this.productName
            );
            results.userExperiences = response.content;
            break;
            
          case 'alternatives':
            response = await this.claudeApi.performResearch(
              `Alternative products similar to ${this.productName} and how they compare`,
              this.productName
            );
            results.alternatives = response.content;
            break;
        }
        
        if (response && response.budgetExhausted) {
          console.log(chalk.yellow(`Research budget exhausted during this phase.`));
        } else {
          console.log(chalk.green(`Research complete for ${phase.name}!`));
        }
      } catch (error) {
        console.error(chalk.red(`Error researching ${phase.name}:`), error.message);
      }
    }
    
    // Show budget summary
    const budgetStatus = this.budgetManager.getStatus();
    console.log(chalk.cyan("\n=== RESEARCH BUDGET SUMMARY ==="));
    console.log(chalk.yellow(`Total budget: $${budgetStatus.budgetUSD.toFixed(2)}`));
    console.log(chalk.yellow(`Used: $${budgetStatus.totalCost.toFixed(2)} (${(100 - budgetStatus.remainingPercentage).toFixed(1)}%)`));
    console.log(chalk.yellow(`Remaining: $${budgetStatus.remainingBudget.toFixed(2)}`));
    
    return results;
  }

  /**
   * Format research results for inclusion in review
   * @param {Object} results - Research results
   * @returns {string} Formatted research
   */
  formatResearchForReview(results) {
    if (!results || (
      !results.basicInfo && 
      !results.gapAnalysis && 
      !results.deepDive && 
      !results.userExperiences && 
      !results.alternatives
    )) {
      return "";
    }
    
    let formatted = "## RESEARCH INSIGHTS\n\n";
    
    // Add each research phase that has content
    if (results.basicInfo) {
      formatted += `### PRODUCT INFORMATION\n\n${this.summarizeContent(results.basicInfo)}\n\n`;
    }
    
    if (results.deepDive) {
      const deepDiveName = this.researchPhases.deepDive.name.toUpperCase();
      formatted += `### ${deepDiveName}\n\n${this.summarizeContent(results.deepDive)}\n\n`;
    }
    
    if (results.userExperiences) {
      formatted += `### USER EXPERIENCES\n\n${this.summarizeContent(results.userExperiences)}\n\n`;
    }
    
    if (results.alternatives) {
      formatted += `### COMPETITIVE ALTERNATIVES\n\n${this.summarizeContent(results.alternatives)}\n\n`;
    }
    
    // Add gap analysis last as it provides guidance on what's still missing
    if (results.gapAnalysis) {
      formatted += `### INFORMATION GAPS\n\n${this.summarizeContent(results.gapAnalysis)}\n\n`;
    }
    
    return formatted;
  }

  /**
   * Extract questions from gap analysis
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
      const response = await this.claudeApi.processMessages(messages, systemPrompt, false);
      
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
   * @returns {string} Summarized content
   */
  summarizeContent(content, limit = 5) {
    // Split content into sentences
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10)
      .slice(0, limit);
    
    return sentences.join(' ');
  }
}

module.exports = { EnhancedResearchPlanner };
