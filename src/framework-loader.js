/**
 * Framework Loader - Utility for loading and parsing the Amazon Review Framework YAML files
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

class FrameworkLoader {
  constructor() {
    this.FRAMEWORK_DIR = path.resolve(__dirname, '../framework');
    this.PHASES_DIR = path.resolve(this.FRAMEWORK_DIR, 'phases');
    this.PROMPTS_DIR = path.resolve(this.FRAMEWORK_DIR, 'prompts');
    this.cachedFrameworks = {};
  }

  /**
   * Load a YAML file and parse its contents
   * @param {string} filePath - Path to the YAML file
   * @returns {Promise<Object>} - Parsed YAML content
   */
  async loadYamlFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      return yaml.load(fileContent);
    } catch (error) {
      console.error(`Error loading YAML file ${filePath}:`, error.message);
      throw new Error(`Failed to load framework file: ${filePath}`);
    }
  }

  /**
   * Load core principles of the framework
   * @returns {Promise<Object>} - Core principles content
   */
  async loadCorePrinciples() {
    const filePath = path.join(this.FRAMEWORK_DIR, 'core-principles.yaml');
    return this.loadYamlFile(filePath);
  }

  /**
   * Load a specific phase's framework
   * @param {string} phase - Phase name (intake, draft, refine, quality)
   * @returns {Promise<Object>} - Phase framework content
   */
  async loadPhaseFramework(phase) {
    const validPhases = ['intake', 'draft', 'refine', 'quality'];
    
    if (!validPhases.includes(phase)) {
      throw new Error(`Invalid phase: ${phase}. Must be one of: ${validPhases.join(', ')}`);
    }
    
    const filePath = path.join(this.PHASES_DIR, `${phase}.yaml`);
    return this.loadYamlFile(filePath);
  }

  /**
   * Load a system prompt for a specific phase
   * @param {string} phase - Phase name (intake, draft, refine, quality)
   * @returns {Promise<string>} - Formatted system prompt for the phase
   */
  async loadSystemPrompt(phase) {
    try {
      // Load the system prompts file
      const promptsFile = path.join(this.PROMPTS_DIR, 'system-prompts.yaml');
      const prompts = await this.loadYamlFile(promptsFile);
      
      // Load core principles for global components
      const corePrinciples = await this.loadCorePrinciples();
      
      // Find the specific phase prompt
      const phasePrompt = prompts.phase_prompts.find(p => p.phase.toLowerCase().includes(phase.toLowerCase()));
      
      if (!phasePrompt) {
        throw new Error(`No system prompt found for phase: ${phase}`);
      }
      
      // Replace global placeholders with content
      let systemPrompt = phasePrompt.system_prompt;
      systemPrompt = systemPrompt.replace('%GLOBAL_ROLE_DEFINITION%', prompts.global_components.core_role_definition.content);
      systemPrompt = systemPrompt.replace('%GLOBAL_CREATIVE_PERMISSIONS%', prompts.global_components.creative_permissions.content);
      systemPrompt = systemPrompt.replace('%GLOBAL_CORE_PRINCIPLES%', prompts.global_components.core_principles.content);
      
      return systemPrompt;
    } catch (error) {
      console.error(`Error loading system prompt for phase ${phase}:`, error.message);
      throw error;
    }
  }

  /**
   * Load user prompt templates for a specific context
   * @param {string} category - Prompt category
   * @param {string} promptType - Specific prompt type within the category
   * @returns {Promise<Array>} - Array of matching prompt templates
   */
  async loadUserPromptTemplates(category, promptType) {
    try {
      // Load the user prompts file
      const promptsFile = path.join(this.PROMPTS_DIR, 'user-prompts.yaml');
      const prompts = await this.loadYamlFile(promptsFile);
      
      // Find the specified category
      const categoryData = prompts[category];
      if (!categoryData) {
        throw new Error(`No prompt category found: ${category}`);
      }
      
      // If promptType is specified, find matching templates
      if (promptType) {
        const templates = categoryData.find(c => c.category === promptType || c.phase === promptType);
        if (!templates) {
          throw new Error(`No prompt type found: ${promptType} in category ${category}`);
        }
        return templates.templates || templates.message || templates;
      }
      
      // Otherwise return the entire category
      return categoryData;
    } catch (error) {
      console.error(`Error loading user prompt templates:`, error.message);
      throw error;
    }
  }

  /**
   * Get a complete framework for a specific phase
   * @param {string} phase - Phase name (intake, draft, refine, quality)
   * @returns {Promise<Object>} - Complete phase framework including core principles
   */
  async getPhaseFramework(phase) {
    try {
      const [corePrinciples, phaseFramework] = await Promise.all([
        this.loadCorePrinciples(),
        this.loadPhaseFramework(phase)
      ]);
      
      return {
        core: corePrinciples,
        phase: phaseFramework
      };
    } catch (error) {
      console.error(`Error loading complete framework for phase ${phase}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a specific section from a phase's framework
   * @param {string} phase - Phase name (intake, draft, refine, quality)
   * @param {string} section - Section name to retrieve
   * @returns {Promise<any>} - Section content
   */
  async getFrameworkSection(phase, section) {
    try {
      const phaseFramework = await this.loadPhaseFramework(phase);
      
      if (!phaseFramework[section]) {
        throw new Error(`Section ${section} not found in ${phase} framework`);
      }
      
      return phaseFramework[section];
    } catch (error) {
      console.error(`Error loading framework section:`, error.message);
      throw error;
    }
  }
/**
 * Get specific section from a phase framework using dot notation
 * @param {string} phase - Phase name (intake, draft, refine, quality)
 * @param {string} sectionPath - Dot notation path to section (e.g., 'humor_framework.humor_techniques')
 * @returns {Promise<any>} - Section content or null if not found
 */
async getFrameworkSection(phase, sectionPath) {
  try {
    // Make sure framework is loaded
    await this.loadPhaseFramework(phase);
    
    if (!this.cachedFrameworks[phase]) {
      throw new Error(`Phase framework not loaded: ${phase}`);
    }
    
    // Parse the section path
    const pathParts = sectionPath.split('.');
    
    // Start with the full framework
    let section = this.cachedFrameworks[phase];
    
    // Navigate through the path
    for (const part of pathParts) {
      if (section && section[part]) {
        section = section[part];
      } else {
        throw new Error(`Section not found: ${sectionPath} in ${phase} framework`);
      }
    }
    
    return section;
  } catch (error) {
    console.error(chalk.red(`Error accessing framework section: ${phase}.${sectionPath}`), error.message);
    return null;
  }
}
  /**
   * Create a dynamic system prompt with custom modifications
   * @param {string} phase - Base phase for the prompt
   * @param {Object} customizations - Custom additions or modifications to the prompt
   * @returns {Promise<string>} - Customized system prompt
   */
  async createDynamicPrompt(phase, customizations = {}) {
    try {
      // Get base prompt for the phase
      let basePrompt = await this.loadSystemPrompt(phase);
      
      // Apply customizations
      if (customizations.productType) {
        basePrompt += `\n\n## PRODUCT TYPE GUIDANCE\n\nThis review is for a ${customizations.productType} product, which typically ${getProductTypeNotes(customizations.productType)}`;
      }
      
      if (customizations.imageAnalysis && customizations.imageAnalysis.length > 0) {
        basePrompt += `\n\n## IMAGE ANALYSIS\n\nThe following images have been provided for analysis:\n${customizations.imageAnalysis.join('\n')}`;
      }
      
      if (customizations.additionalInstructions) {
        basePrompt += `\n\n## ADDITIONAL INSTRUCTIONS\n\n${customizations.additionalInstructions}`;
      }
      
      if (customizations.phaseHistory) {
        basePrompt += `\n\n## PREVIOUS PHASE INFORMATION\n\n${customizations.phaseHistory}`;
      }
      // In createDynamicPrompt method, before returning basePrompt
      if (phase === 'draft') {
        const personalityGuidelines = await this.getEnhancedPersonalityGuidelines();
        
        basePrompt += "\n\n## ENHANCED PERSONALITY GUIDANCE\n\n";
        basePrompt += "The following techniques MUST be incorporated into the review:\n\n";
        
        // Add humor techniques
        basePrompt += "### Humor Techniques:\n";
        personalityGuidelines.humorTechniques.forEach(technique => {
          basePrompt += `- **${technique.name}**: ${technique.description}\n`;
          if (technique.example) {
            basePrompt += `  Example: "${technique.example}"\n`;
          }
        });
        
        // Add personality elements
        basePrompt += "\n### Personality Elements:\n";
        personalityGuidelines.personalityElements.forEach(element => {
          basePrompt += `- **${element.name}**: ${element.description}\n`;
          if (element.example) {
            basePrompt += `  Example: "${element.example}"\n`;
          }
        });
        
        // Add implementation guidance
        basePrompt += "\n### Implementation Requirements:\n";
        personalityGuidelines.implementation.forEach(guidance => {
          basePrompt += `- ${guidance}\n`;
        });
      }
      // Add Draft framework info for Refine phase
      if (phase === 'refine') {
        try {
          // Load the draft framework
          await this.loadPhaseFramework('draft');
          const draftFramework = this.cachedFrameworks['draft'];
          
          if (draftFramework) {
            basePrompt += "\n\n## DRAFT FRAMEWORK REFERENCE\n\n";
            
            // Add humor framework
            if (draftFramework.humor_framework) {
              basePrompt += "### Humor Techniques\n";
              const humorTechniques = draftFramework.humor_framework.humor_techniques?.approaches;
              if (humorTechniques && Array.isArray(humorTechniques)) {
                humorTechniques.forEach(technique => {
                  basePrompt += `- **${technique.technique}**: ${technique.description}\n`;
                  if (technique.example) {
                    basePrompt += `  Example: "${technique.example}"\n`;
                  }
                });
              }
              basePrompt += "\n";
            }
            
            // Add personality techniques
            if (draftFramework.personality_techniques?.creative_elements) {
              basePrompt += "### Creative Elements for Personality\n";
              draftFramework.personality_techniques.creative_elements.forEach(element => {
                basePrompt += `- **${element.name}**: ${element.description}\n`;
                if (element.example) {
                  basePrompt += `  Example: "${element.example}"\n`;
                }
              });
              basePrompt += "\n";
            }
            
            // Add information/personality balance guidance
            if (draftFramework.information_personality_balance) {
              basePrompt += "### Information/Personality Balance\n";
              const ratios = draftFramework.information_personality_balance.baseline_ratios;
              basePrompt += `- Baseline ratio: ${ratios.informational}% information, ${ratios.personality}% personality\n\n`;
              
              if (draftFramework.information_personality_balance.section_specific_adjustments) {
                basePrompt += "Section-specific adjustments:\n";
                draftFramework.information_personality_balance.section_specific_adjustments.forEach(adjustment => {
                  basePrompt += `- ${adjustment.content_type}: ${adjustment.personality_adjustment} (${adjustment.rationale})\n`;
                });
              }
              basePrompt += "\n\n## PERSONALITY GUIDANCE\n\n";
              basePrompt += "This review MUST have a distinct personality and appropriate humor from the first draft. Remember:\n\n";
              basePrompt += "- Use your judgment to incorporate humor and personality elements that fit this specific product and experience\n";
              basePrompt += "- Maintain a strong, distinctive voice throughout - don't default to generic product descriptions\n";
              basePrompt += "- Find natural opportunities for creative comparisons, analogies, or observations\n";
              basePrompt += "- Balance factual information with engaging personality (target ~40-45% personality elements)\n\n";
              basePrompt += "Your first draft should demonstrate a clear personality approach without waiting for additional requests. Choose humor and personality techniques that best suit this specific product and review style.\n";
              basePrompt += "\n";
            }
            
            // For technical or complex product reviews
            if (customizations.productType && ['electronics', 'tool', 'software', 'kitchen'].includes(customizations.productType.toLowerCase())) {
              basePrompt += "\n\n## LIST FORMAT GUIDANCE\n\n";
              basePrompt += "For this technical product review, consider using concise list formats where appropriate:\n\n";
              basePrompt += "- Organize key pros and cons in scannable bullet points\n";
              basePrompt += "- Present technical specifications in a structured format when listing multiple attributes\n";
              basePrompt += "- Use lists to identify ideal users or use cases\n\n";
              basePrompt += "Lists should complement paragraph content by providing organized access to key points, not by repeating the same information in the same way. Each format should serve a distinct purpose in the review.\n";
            }
            // Include formatting guidelines
            if (draftFramework.content_structure?.formatting_guidelines) {
              basePrompt += "### Formatting Guidelines\n";
              draftFramework.content_structure.formatting_guidelines.forEach(guideline => {
                basePrompt += `- ${guideline}\n`;
              });
              basePrompt += "\n";
            }
          }
        } catch (error) {
          console.log(chalk.yellow(`Note: Could not include draft framework in refine prompt: ${error.message}`));
        }
      }
      return basePrompt;
    } catch (error) {
      console.error(`Error creating dynamic prompt:`, error.message);
      throw error;
    }
  }
}

/**
 * Get guidance notes for specific product types
 * @param {string} productType - Type of product
 * @returns {string} - Product-specific guidance notes
 */
function getProductTypeNotes(productType) {
  const productTypeGuidance = {
    'electronics': 'benefits from detailed technical specifications and compatibility information.',
    'clothing': 'requires attention to sizing, fit, material quality, and comfort details.',
    'kitchen': 'should address food safety, cleaning ease, and practical usage scenarios.',
    'beauty': 'needs specific information about ingredients, skin/hair types, and results over time.',
    'tool': 'should focus on durability, ergonomics, and performance across different applications.',
    'toy': 'requires attention to age-appropriateness, durability, and educational/entertainment value.',
    'book': 'should address writing style, content quality, and target audience without spoilers.',
    'software': 'needs discussion of user interface, performance, learning curve, and practical applications.'
  };
  
  return productTypeGuidance[productType.toLowerCase()] || 
         'should include both technical details and practical usage experiences.';
}

module.exports = { FrameworkLoader };

// Add this method to the existing FrameworkLoader class before the module.exports line
FrameworkLoader.prototype.getRefiningGuidelines = async function() {
  try {
    // Load key sections from different phases
    const draftFramework = await this.loadPhaseFramework('draft');
    const refineFramework = await this.loadPhaseFramework('refine');
    const qualityFramework = await this.loadPhaseFramework('quality');
    
    // Extract the most relevant sections
    return {
      // Personality and humor guidelines
      humorFramework: draftFramework.humor_framework,
      personalityTechniques: draftFramework.personality_techniques,
      informationPersonalityBalance: draftFramework.information_personality_balance,
      
      // Formatting guidelines
      formattingGuidelines: draftFramework.content_structure?.formatting_guidelines,
      
      // Redundancy prevention
      redundancyReview: qualityFramework.redundancy_review,
      
      // Balance disruption guidance (important for maintaining balance during edits)
      balanceDisruption: refineFramework.quality_assurance?.revision_pitfalls?.find(p => p.pitfall === "Balance Disruption")
    };
  } catch (error) {
    console.error(`Error loading refining guidelines:`, error.message);
    return {};
  }
};