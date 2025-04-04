/**
 * Framework Loader - Utility for loading and parsing the Amazon Review Framework YAML files
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class FrameworkLoader {
  constructor() {
    this.FRAMEWORK_DIR = path.resolve(__dirname, '../framework');
    this.PHASES_DIR = path.resolve(this.FRAMEWORK_DIR, 'phases');
    this.PROMPTS_DIR = path.resolve(this.FRAMEWORK_DIR, 'prompts');
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

class FrameworkLoader {
  async getRefiningGuidelines() {
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
  }}