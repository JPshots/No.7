/**
 * Claude API Integration with Web Search and Budget Management
 * Handles communication with Anthropic's Claude API including web search with cost limits
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const chalk = require('chalk');
const { TokenBudgetManager } = require('./token-budget-manager');

class ClaudeAPI {
  constructor() {
    // Initialize Anthropic client with API key from environment
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Default model configuration
    this.model = process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';
    this.maxTokens = parseInt(process.env.MAX_TOKENS) || 4000;
    this.temperature = parseFloat(process.env.TEMPERATURE) || 0.7;
    
    // Web search configuration
    this.useWebSearch = process.env.ENABLE_WEB_SEARCH === 'true' || false;
    
    // Initialize token budget manager
    this.budgetManager = new TokenBudgetManager({
      budgetUSD: parseFloat(process.env.RESEARCH_BUDGET_USD) || 0.50
    });
    
    // Estimation constants (average tokens per character)
    this.TOKEN_PER_CHAR_RATIO = 0.25; // Approximation: 4 characters per token
  }

  /**
   * Process messages with Claude
   * @param {Array} messages - Array of message objects
   * @param {string} systemPrompt - System prompt to use
   * @param {boolean} enableSearch - Enable web search for this request
   * @returns {Object} Claude's response
   */
  async processMessages(messages, systemPrompt, enableSearch = this.useWebSearch) {
    try {
      // Don't use web search if budget is exhausted
      if (enableSearch && this.budgetManager.budgetExhausted) {
        console.log(chalk.yellow("Warning: Research budget exhausted. Disabling web search."));
        enableSearch = false;
      }
      
      if (global.VERBOSE_MODE) {
        console.log(chalk.gray('Sending request to Claude API...'));
        console.log(chalk.gray(`System prompt length: ${systemPrompt.length} characters`));
        console.log(chalk.gray(`Messages: ${messages.length}`));
        console.log(chalk.gray(`Web search enabled: ${enableSearch}`));
        
        if (enableSearch) {
          console.log(chalk.gray(`Remaining research budget: $${this.budgetManager.remainingBudget.toFixed(2)}`));
        }
      }
      
      // Estimate token usage
      const inputEstimate = this.estimateInputTokens(messages, systemPrompt);
      
      // Check if this would exceed budget (for web search only)
      if (enableSearch && this.budgetManager.wouldExceedBudget(inputEstimate, this.maxTokens)) {
        console.log(chalk.yellow("Warning: This request would exceed remaining research budget. Disabling web search."));
        enableSearch = false;
      }
      
      // Create API request options
      const requestOptions = {
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: this.prepareMessages(messages),
        temperature: this.temperature
      };
      
      // Add web search tools if enabled
      if (enableSearch) {
        requestOptions.tools = [
          {
            name: "web_search"
          }
        ];
      }
      
      // Send request to Claude API
      const response = await this.anthropic.messages.create(requestOptions);
      
      // Record token usage for research budget management (only for web search requests)
      if (enableSearch && response.usage) {
        this.budgetManager.recordUsage({
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        });
        
        if (global.VERBOSE_MODE) {
          const status = this.budgetManager.getStatus();
          console.log(chalk.gray(`Research budget used: $${status.totalCost.toFixed(2)} / $${status.budgetUSD.toFixed(2)} (${(100 - status.remainingPercentage).toFixed(1)}%)`));
        }
      }
      
      if (global.VERBOSE_MODE) {
        console.log(chalk.gray('Response received from Claude API'));
        console.log(chalk.gray(`Response length: ${response.content[0].text.length} characters`));
        
        if (response.usage) {
          console.log(chalk.gray(`Input tokens: ${response.usage.input_tokens}`));
          console.log(chalk.gray(`Output tokens: ${response.usage.output_tokens}`));
        }
      }
      
      return {
        content: response.content[0].text,
        usage: response.usage,
        toolUse: response.content.some(c => c.type === 'tool_use')
      };
    } catch (error) {
      console.error(chalk.red('Error communicating with Claude API:'), error.message);
      
      // Handle specific API errors
      if (error.status === 401) {
        throw new Error('Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.status === 400) {
        throw new Error(`API request error: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Process a specialized research task with web search enabled
   * @param {string} query - Research query
   * @param {string} productName - Name of the product being reviewed
   * @returns {Object} Claude's response with research results
   */
  async performResearch(query, productName) {
    try {
      // Check if we can perform research within our budget
      if (this.budgetManager.budgetExhausted) {
        console.log(chalk.yellow(`Research budget exhausted ($${this.budgetManager.budgetUSD.toFixed(2)}). Skipping research.`));
        return {
          content: "Research budget exhausted. Unable to perform additional research.",
          budgetExhausted: true
        };
      }
      
      console.log(chalk.cyan(`Researching: ${query}`));
      
      // Create a concise system prompt for research (to save tokens)
      const researchPrompt = `
You are a research assistant helping gather information for an Amazon product review of ${productName}.
Use web search to find helpful, factual information about: ${query}
Keep your response brief and focused on the most valuable insights. Prioritize factual information that would help in writing a review.
`;

      // Create a single message with the research query
      const messages = [
        {
          role: 'user',
          content: `Research key information about ${productName}: ${query}`
        }
      ];
      
      // Estimate token usage for budget checking
      const inputEstimate = this.estimateInputTokens(messages, researchPrompt);
      const outputEstimate = 2000; // Conservative estimate for output tokens
      
      if (this.budgetManager.wouldExceedBudget(inputEstimate, outputEstimate)) {
        console.log(chalk.yellow(`This research would exceed the remaining budget of $${this.budgetManager.remainingBudget.toFixed(2)}. Skipping.`));
        return {
          content: "Research budget would be exceeded. Unable to perform this research.",
          budgetExhausted: true
        };
      }
      
      // Process with web search enabled
      return await this.processMessages(messages, researchPrompt, true);
    } catch (error) {
      console.error(chalk.red('Error performing research:'), error.message);
      throw error;
    }
  }

  /**
   * Research product gaps for more comprehensive review (budget-aware)
   * @param {string} productName - Name of the product 
   * @param {string} productType - Type of product
   * @param {Array} currentInsights - Current insights already gathered
   * @returns {Object} Claude's response with gap analysis
   */
  async analyzeProductGaps(productName, productType, currentInsights) {
    try {
      // Check if we can perform gap analysis within our budget
      if (this.budgetManager.budgetExhausted) {
        console.log(chalk.yellow(`Research budget exhausted ($${this.budgetManager.budgetUSD.toFixed(2)}). Skipping gap analysis.`));
        return {
          content: "Research budget exhausted. Unable to perform gap analysis.",
          budgetExhausted: true
        };
      }
      
      console.log(chalk.cyan(`Analyzing gaps in product knowledge: ${productName}`));
      
      // Create a concise system prompt for gap analysis (to save tokens)
      const gapAnalysisPrompt = `
You are helping identify information gaps for a more comprehensive product review of ${productName} (${productType}).
Use web search to identify what might be missing from the current understanding.

Current insights include: ${currentInsights.slice(0, 5).join(' | ')}${currentInsights.length > 5 ? ' | [additional insights omitted]' : ''}

Focus on finding the 3-4 most critical missing pieces of information.
Be extremely concise - list only the key gaps without extensive explanation.
`;

      // Create a message for gap analysis
      const messages = [
        {
          role: 'user',
          content: `Identify the 3-4 most important information gaps for a review of ${productName}`
        }
      ];
      
      // Estimate token usage for budget checking
      const inputEstimate = this.estimateInputTokens(messages, gapAnalysisPrompt);
      const outputEstimate = 1500; // Conservative estimate for output tokens
      
      if (this.budgetManager.wouldExceedBudget(inputEstimate, outputEstimate)) {
        console.log(chalk.yellow(`Gap analysis would exceed the remaining budget of $${this.budgetManager.remainingBudget.toFixed(2)}. Skipping.`));
        return {
          content: "Research budget would be exceeded. Unable to perform gap analysis.",
          budgetExhausted: true
        };
      }
      
      // Process with web search enabled
      return await this.processMessages(messages, gapAnalysisPrompt, true);
    } catch (error) {
      console.error(chalk.red('Error analyzing product gaps:'), error.message);
      throw error;
    }
  }

  /**
   * Get optimized research plan to fit within budget
   * @param {string} productName - Product name
   * @param {string} productType - Product type
   * @returns {Object} Research plan
   */
  getResearchPlan(productName, productType) {
    // Get optimized plan from budget manager
    const plan = this.budgetManager.getOptimizedResearchPlan();
    
    if (!plan.canResearch) {
      return {
        canResearch: false,
        message: `Research budget of $${this.budgetManager.budgetUSD.toFixed(2)} is exhausted.`
      };
    }
    
    // Convert the abstract plan to specific research topics
    const researchPlan = {
      canResearch: true,
      budget: {
        total: this.budgetManager.budgetUSD,
        remaining: this.budgetManager.remainingBudget,
        used: this.budgetManager.totalCost
      },
      topics: []
    };
    
    // Map the abstract operations to concrete research topics based on product type
    plan.plan.forEach(operation => {
      if (operation === 'general_research') {
        researchPlan.topics.push({
          name: `General information about ${productName}`,
          type: 'general',
          priority: 'high'
        });
      } else if (operation === 'gap_analysis') {
        researchPlan.topics.push({
          name: 'Information gap analysis',
          type: 'gap_analysis',
          priority: 'medium'
        });
      } else if (operation === 'additional_research') {
        // Add product-type specific research if budget allows
        const specificTopic = this.getProductTypeSpecificTopic(productType);
        researchPlan.topics.push({
          name: specificTopic,
          type: 'specific',
          priority: 'low'
        });
      }
    });
    
    return researchPlan;
  }

  /**
   * Reset the budget manager
   */
  resetBudget() {
    this.budgetManager.reset();
  }

  /**
   * Get budget status
   * @returns {Object} Budget status
   */
  getBudgetStatus() {
    return this.budgetManager.getStatus();
  }

  /**
   * Prepare messages for API request
   * @param {Array} messages - Array of message objects
   * @returns {Array} Formatted messages for Claude API
   */
  prepareMessages(messages) {
    return messages.map(message => {
      // Clone the message to avoid modifying the original
      const formattedMessage = { ...message };
      
      // Handle first message with images
      if (Array.isArray(formattedMessage.content)) {
        // Message with images (already in correct format)
        return formattedMessage;
      } else {
        // Text-only message
        return {
          role: formattedMessage.role,
          content: formattedMessage.content
        };
      }
    });
  }

  /**
   * Estimate input tokens for a request
   * @param {Array} messages - Messages array
   * @param {string} systemPrompt - System prompt
   * @returns {number} Estimated input tokens
   */
  estimateInputTokens(messages, systemPrompt) {
    // System prompt tokens
    let totalTokens = Math.ceil(systemPrompt.length * this.TOKEN_PER_CHAR_RATIO);
    
    // Message tokens
    messages.forEach(message => {
      if (typeof message.content === 'string') {
        totalTokens += Math.ceil(message.content.length * this.TOKEN_PER_CHAR_RATIO);
      } else if (Array.isArray(message.content)) {
        // Handle messages with images
        message.content.forEach(content => {
          if (content.type === 'text') {
            totalTokens += Math.ceil(content.text.length * this.TOKEN_PER_CHAR_RATIO);
          } else if (content.type === 'image') {
            // Images add a fixed token cost (approximate)
            totalTokens += 500;
          }
        });
      }
    });
    
    // Add overhead for message formatting
    totalTokens += messages.length * 20;
    
    return totalTokens;
  }

  /**
   * Get a product-type specific research topic
   * @param {string} productType - Product type
   * @returns {string} Research topic
   */
  getProductTypeSpecificTopic(productType) {
    const typeSpecificTopics = {
      'electronics': 'Common issues and troubleshooting tips',
      'kitchen': 'Cleaning and maintenance requirements',
      'clothing': 'Sizing and fit information',
      'beauty': 'Ingredient analysis and sensitivities',
      'tool': 'Durability and warranty information',
      'toy': 'Age-appropriateness and safety considerations',
      'book': 'Author background and similar titles',
      'software': 'Compatibility and system requirements'
    };
    
    return typeSpecificTopics[productType.toLowerCase()] || 'Product alternatives and comparisons';
  }

  /**
   * Set the Claude model to use
   * @param {string} model - Model identifier
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * Set the maximum number of tokens for Claude's response
   * @param {number} maxTokens - Maximum tokens
   */
  setMaxTokens(maxTokens) {
    this.maxTokens = maxTokens;
  }
  
  /**
   * Set the temperature for Claude's response
   * @param {number} temperature - Temperature (0.0 to 1.0)
   */
  setTemperature(temperature) {
    this.temperature = temperature;
  }
  
  /**
   * Enable or disable web search
   * @param {boolean} enable - Whether to enable web search
   */
  setWebSearch(enable) {
    this.useWebSearch = enable;
  }
}

module.exports = { ClaudeAPI };
