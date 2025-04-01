/**
 * Simplified Research Planner
 * Implements a fixed allocation strategy with Claude's intelligence for research topics
 */

const chalk = require('chalk');
const inquirer = require('inquirer');

class SimplifiedResearchPlanner {
  /**
   * Create a new SimplifiedResearchPlanner
   * @param {ClaudeAPI} claudeApi - Claude API instance
   * @param {string} productName - Product name
   * @param {string} productType - Product type
   */
  constructor(claudeApi, productName, productType) {
    this.claudeApi = claudeApi;
    this.productName = productName;
    this.productType = productType;
    this.budgetManager = claudeApi.budgetManager;
    
    // Fixed budget allocation
    this.gapAnalysisAllocation = 0.35; // 35% for gap analysis
    this.productResearchAllocation = 0.65; // 65% for product-specific research
  }

  /**
   * Generate research plan based on fixed allocation
   * @returns {Object} Research plan
   */
  generateResearchPlan() {
    // Get total budget
    const totalBudget = this.budgetManager.budgetUSD;
    
    // Calculate allocations
    const gapBudget = totalBudget * this.gapAnalysisAllocation;
    const researchBudget = totalBudget * this.productResearchAllocation;
    
    // Plan structure
    const plan = {
      totalBudget: totalBudget,
      gapAnalysis: {
        budget: gapBudget,
        enabled: true
      },
      productResearch: {
        budget: researchBudget,
        topics: this.getProductResearchTopics(this.productType)
      }
    };
    
    return plan;
  }

  /**
   * Get product-specific research topics based on product type
   * @param {string} productType - Type of product
   * @returns {Array} Research topics
   */
  getProductResearchTopics(productType) {
    // Base topics applicable to most products
    const baseTopics = [
      {
        name: "General product information",
        description: "Overall product information, specifications, and key features",
        priority: "high",
        budgetRatio: 0.3
      }
    ];
    
    // Type-specific topics
    const typeSpecificTopics = this.getTypeSpecificTopics(productType);
    
    // Combine topics and adjust budget ratios
    const allTopics = [...baseTopics, ...typeSpecificTopics];
    
    // Normalize budget ratios to ensure they sum to 1.0
    const totalRatio = allTopics.reduce((sum, topic) => sum + topic.budgetRatio, 0);
    allTopics.forEach(topic => {
      topic.budgetRatio = topic.budgetRatio / totalRatio;
    });
    
    return allTopics;
  }

  /**
   * Get research topics specific to a product type
   * @param {string} productType - Type of product
   * @returns {Array} Type-specific research topics
   */
  getTypeSpecificTopics(productType) {
    // Default topics for unknown product types
    const defaultTopics = [
      {
        name: "User experiences and reviews",
        description: "Common user experiences, feedback, and reviews",
        priority: "medium",
        budgetRatio: 0.3
      },
      {
        name: "Alternatives and comparisons",
        description: "Similar products and competitive comparisons",
        priority: "medium",
        budgetRatio: 0.4
      }
    ];
    
    // Product type specific topics
    switch (productType.toLowerCase()) {
      case 'electronics':
        return [
          {
            name: "Technical specifications and performance",
            description: "Detailed specifications, performance benchmarks, and compatibility",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Common issues and troubleshooting",
            description: "Known problems, bugs, and troubleshooting solutions",
            priority: "medium",
            budgetRatio: 0.2
          },
          {
            name: "Alternatives and comparisons",
            description: "Similar products and competitive comparisons",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'kitchen':
        return [
          {
            name: "Usage and recipes",
            description: "How the product is typically used, recipe adaptations",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Cleaning and maintenance",
            description: "Cleaning requirements, maintenance tips, durability",
            priority: "medium",
            budgetRatio: 0.2
          },
          {
            name: "Material safety and food compatibility",
            description: "Material composition, food safety considerations",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'clothing':
        return [
          {
            name: "Material and construction",
            description: "Fabric details, manufacturing quality, durability",
            priority: "high",
            budgetRatio: 0.25
          },
          {
            name: "Sizing and fit information",
            description: "Sizing accuracy, fit considerations, customer experiences",
            priority: "high",
            budgetRatio: 0.25
          },
          {
            name: "Care instructions",
            description: "Washing, maintenance, and longevity considerations",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'beauty':
        return [
          {
            name: "Ingredient analysis",
            description: "Key ingredients, formulation details, potential concerns",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Skin/hair type compatibility",
            description: "Suitability for different skin/hair types, sensitivities",
            priority: "high",
            budgetRatio: 0.2
          },
          {
            name: "Application techniques",
            description: "Best practices for application, tips and tricks",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'tool':
        return [
          {
            name: "Performance and applications",
            description: "Performance in various applications, capability limits",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Durability and reliability",
            description: "Build quality, longevity considerations, common failure points",
            priority: "high",
            budgetRatio: 0.2
          },
          {
            name: "Maintenance requirements",
            description: "Cleaning, storage, maintenance needs",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'toy':
        return [
          {
            name: "Age appropriateness and educational value",
            description: "Suitable age ranges, educational benefits, developmental aspects",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Safety considerations",
            description: "Safety certifications, potential hazards, parent concerns",
            priority: "high",
            budgetRatio: 0.25
          },
          {
            name: "Durability and play value",
            description: "Construction quality, longevity, sustained interest",
            priority: "medium",
            budgetRatio: 0.1
          }
        ];
        
      case 'book':
        return [
          {
            name: "Author background and similar works",
            description: "Information about the author, similar books, writing style",
            priority: "high",
            budgetRatio: 0.25
          },
          {
            name: "Critical reception",
            description: "Professional reviews, reader feedback, awards",
            priority: "high",
            budgetRatio: 0.25
          },
          {
            name: "Content themes and appropriateness",
            description: "Major themes, content warnings, target audience",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      case 'software':
        return [
          {
            name: "Features and capabilities",
            description: "Key features, unique selling points, limitations",
            priority: "high",
            budgetRatio: 0.3
          },
          {
            name: "Compatibility and requirements",
            description: "System requirements, platform compatibility, integration",
            priority: "high",
            budgetRatio: 0.2
          },
          {
            name: "User interface and learning curve",
            description: "Ease of use, learning resources, user experience",
            priority: "medium",
            budgetRatio: 0.15
          }
        ];
        
      default:
        return defaultTopics;
    }
  }

  /**
   * Execute research according to the plan
   * @returns {Object} Research results
   */
  async executeResearch() {
    const results = {
      gapAnalysis: null,
      productResearch: []
    };
    
    console.log(chalk.cyan("\n=== RESEARCH PLAN ==="));
    console.log(chalk.yellow(`Budget allocation: 35% gap analysis, 65% product research`));
    console.log(chalk.yellow(`Total research budget: $${this.budgetManager.budgetUSD.toFixed(2)}`));
    
    // Generate the research plan
    const plan = this.generateResearchPlan();
    
    // Get current insights to use for gap analysis
    const currentInsights = [];
    
    // Execute product research first (prioritizing high priority topics)
    const researchTopics = plan.productResearch.topics
      .sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return 0;
      });
    
    for (const topic of researchTopics) {
      // Check if we have budget remaining
      if (this.budgetManager.budgetExhausted) {
        console.log(chalk.yellow("Research budget exhausted. Skipping remaining topics."));
        break;
      }
      
      console.log(chalk.cyan(`\nResearching: ${topic.name}`));
      console.log(chalk.gray(topic.description));
      
      try {
        // Execute the research
        const response = await this.claudeApi.performResearch(
          topic.name,
          this.productName
        );
        
        if (response.budgetExhausted) {
          console.log(chalk.yellow("Research budget exhausted during this topic."));
        } else {
          // Store result
          results.productResearch.push({
            topic: topic.name,
            result: response.content
          });
          
          // Add to current insights for gap analysis
          currentInsights.push(`Research on ${topic.name}: Complete`);
          
          console.log(chalk.green("Research complete!"));
        }
      } catch (error) {
        console.error(chalk.red(`Error researching ${topic.name}:`), error.message);
      }
    }
    
    // Execute gap analysis if budget remains and we have research to analyze
    if (!this.budgetManager.budgetExhausted && results.productResearch.length > 0) {
      console.log(chalk.cyan("\n=== GAP ANALYSIS ==="));
      console.log(chalk.yellow("Analyzing what information might be missing..."));
      
      try {
        const response = await this.claudeApi.analyzeProductGaps(
          this.productName,
          this.productType,
          currentInsights
        );
        
        if (response.budgetExhausted) {
          console.log(chalk.yellow("Research budget exhausted during gap analysis."));
        } else {
          // Store result
          results.gapAnalysis = response.content;
          console.log(chalk.green("Gap analysis complete!"));
        }
      } catch (error) {
        console.error(chalk.red("Error performing gap analysis:"), error.message);
      }
    } else if (this.budgetManager.budgetExhausted) {
      console.log(chalk.yellow("\nResearch budget exhausted. Skipping gap analysis."));
    } else {
      console.log(chalk.yellow("\nNo product research completed. Skipping gap analysis."));
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
    if (!results || (results.productResearch.length === 0 && !results.gapAnalysis)) {
      return "";
    }
    
    let formatted = "## RESEARCH INSIGHTS\n\n";
    
    // Add product research
    if (results.productResearch.length > 0) {
      results.productResearch.forEach(research => {
        formatted += `### ${research.topic.toUpperCase()}\n\n`;
        
        // Extract key points (first few lines for brevity)
        const lines = research.result.split('\n').filter(line => line.trim().length > 0);
        const summary = lines.slice(0, 3).join('\n');
        formatted += summary;
        
        if (lines.length > 3) {
          formatted += "\n...(additional insights available)";
        }
        
        formatted += "\n\n";
      });
    }
    
    // Add gap analysis
    if (results.gapAnalysis) {
      formatted += "### INFORMATION GAPS\n\n";
      formatted += results.gapAnalysis;
    }
    
    return formatted;
  }
}

module.exports = { SimplifiedResearchPlanner };
