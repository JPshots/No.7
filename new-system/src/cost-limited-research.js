/**
 * Token Budget Manager for Amazon Review Framework
 * Ensures research operations stay within a budget limit
 */

class TokenBudgetManager {
  /**
   * Create a new TokenBudgetManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Default pricing in USD per million tokens (based on Claude 3 Sonnet pricing)
    this.inputTokenPrice = options.inputTokenPrice || 3.0; // $3.00 per million input tokens
    this.outputTokenPrice = options.outputTokenPrice || 15.0; // $15.00 per million output tokens
    
    // Default token budget in USD (default: $0.50)
    this.budgetUSD = parseFloat(process.env.RESEARCH_BUDGET_USD) || options.budgetUSD || 0.50;
    
    // Token usage tracking
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.apiCalls = 0;
    
    // Budget status
    this.budgetExhausted = false;
    this.warnings = [];
  }

  /**
   * Calculate cost of tokens in USD
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @returns {number} Cost in USD
   */
  calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000000) * this.inputTokenPrice;
    const outputCost = (outputTokens / 1000000) * this.outputTokenPrice;
    return inputCost + outputCost;
  }

  /**
   * Calculate total cost so far in USD
   * @returns {number} Total cost in USD
   */
  get totalCost() {
    return this.calculateCost(this.totalInputTokens, this.totalOutputTokens);
  }

  /**
   * Get remaining budget in USD
   * @returns {number} Remaining budget in USD
   */
  get remainingBudget() {
    return Math.max(0, this.budgetUSD - this.totalCost);
  }

  /**
   * Get remaining budget as percentage
   * @returns {number} Percentage of budget remaining (0-100)
   */
  get remainingBudgetPercentage() {
    return (this.remainingBudget / this.budgetUSD) * 100;
  }

  /**
   * Check if a proposed operation would exceed the budget
   * @param {number} estimatedInputTokens - Estimated input tokens
   * @param {number} estimatedOutputTokens - Estimated output tokens
   * @returns {boolean} True if operation would exceed budget
   */
  wouldExceedBudget(estimatedInputTokens, estimatedOutputTokens) {
    const estimatedCost = this.calculateCost(estimatedInputTokens, estimatedOutputTokens);
    return (this.totalCost + estimatedCost) > this.budgetUSD;
  }

  /**
   * Record token usage from an API call
   * @param {Object} usage - Token usage data
   * @param {number} usage.inputTokens - Input tokens used
   * @param {number} usage.outputTokens - Output tokens used
   */
  recordUsage(usage) {
    this.totalInputTokens += usage.inputTokens || 0;
    this.totalOutputTokens += usage.outputTokens || 0;
    this.apiCalls++;
    
    // Check if budget is now exhausted
    if (this.totalCost >= this.budgetUSD) {
      this.budgetExhausted = true;
    }
    
    // Add warning if approaching budget limit
    if (this.remainingBudgetPercentage < 20 && !this.warnings.includes('approaching_limit')) {
      this.warnings.push('approaching_limit');
    }
  }

  /**
   * Get budget status report
   * @returns {Object} Budget status
   */
  getStatus() {
    return {
      budgetUSD: this.budgetUSD,
      totalCost: this.totalCost,
      remainingBudget: this.remainingBudget,
      remainingPercentage: this.remainingBudgetPercentage,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      apiCalls: this.apiCalls,
      budgetExhausted: this.budgetExhausted,
      warnings: this.warnings
    };
  }

  /**
   * Estimate tokens for a research operation
   * @param {string} operationType - Type of operation
   * @returns {Object} Estimated token usage
   */
  estimateResearchTokens(operationType) {
    // These are conservative estimates based on typical usage patterns
    switch (operationType) {
      case 'general_research':
        return { inputTokens: 300, outputTokens: 1500 };
      case 'detailed_research':
        return { inputTokens: 500, outputTokens: 2500 };
      case 'gap_analysis':
        return { inputTokens: 800, outputTokens: 1800 };
      case 'question_generation':
        return { inputTokens: 1000, outputTokens: 800 };
      default:
        return { inputTokens: 500, outputTokens: 1500 };
    }
  }

  /**
   * Get optimized research plan to fit within budget
   * @returns {Object} Research plan
   */
  getOptimizedResearchPlan() {
    // If budget is already exhausted, return empty plan
    if (this.budgetExhausted) {
      return {
        canResearch: false,
        plan: []
      };
    }
    
    // Calculate how many operations we can fit in the remaining budget
    const remainingBudgetTokens = {
      // Convert dollars to tokens based on pricing
      inputTokens: (this.remainingBudget / this.inputTokenPrice) * 1000000,
      outputTokens: (this.remainingBudget / this.outputTokenPrice) * 1000000
    };
    
    // For $0.50 budget, typically this allows:
    // - 2-3 general research queries
    // - OR 1 detailed research + 1 gap analysis
    // - OR other combinations
    
    const plan = [];
    let remainingInputTokens = remainingBudgetTokens.inputTokens;
    let remainingOutputTokens = remainingBudgetTokens.outputTokens;
    
    // First, prioritize 1 general research (always useful)
    const generalResearch = this.estimateResearchTokens('general_research');
    if (generalResearch.inputTokens <= remainingInputTokens && 
        generalResearch.outputTokens <= remainingOutputTokens) {
      plan.push('general_research');
      remainingInputTokens -= generalResearch.inputTokens;
      remainingOutputTokens -= generalResearch.outputTokens;
    }
    
    // Then try to fit gap analysis if possible
    const gapAnalysis = this.estimateResearchTokens('gap_analysis');
    if (gapAnalysis.inputTokens <= remainingInputTokens && 
        gapAnalysis.outputTokens <= remainingOutputTokens) {
      plan.push('gap_analysis');
      remainingInputTokens -= gapAnalysis.inputTokens;
      remainingOutputTokens -= gapAnalysis.outputTokens;
    }
    
    // If we still have budget, add another general research
    if (generalResearch.inputTokens <= remainingInputTokens && 
        generalResearch.outputTokens <= remainingOutputTokens) {
      plan.push('additional_research');
      remainingInputTokens -= generalResearch.inputTokens;
      remainingOutputTokens -= generalResearch.outputTokens;
    }
    
    return {
      canResearch: plan.length > 0,
      plan: plan,
      remainingBudget: this.remainingBudget,
      estimatedApiCalls: plan.length
    };
  }

  /**
   * Reset budget tracking
   */
  reset() {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.apiCalls = 0;
    this.budgetExhausted = false;
    this.warnings = [];
  }
}

module.exports = { TokenBudgetManager };
