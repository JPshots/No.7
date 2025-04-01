/**
 * Claude API Integration
 * Handles communication with Anthropic's Claude API
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const chalk = require('chalk');

class ClaudeAPI {
  constructor() {
    // Initialize Anthropic client with API key from environment
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Default model configuration
    this.model = 'claude-3-7-sonnet-20250219';
    this.maxTokens = 4000;
  }

  /**
   * Process messages with Claude
   * @param {Array} messages - Array of message objects
   * @param {string} systemPrompt - System prompt to use
   * @returns {Object} Claude's response
   */
  async processMessages(messages, systemPrompt) {
    try {
      if (global.VERBOSE_MODE) {
        console.log(chalk.gray('Sending request to Claude API...'));
        console.log(chalk.gray(`System prompt length: ${systemPrompt.length} characters`));
        console.log(chalk.gray(`Messages: ${messages.length}`));
      }
      
      // Create API request
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: this.prepareMessages(messages),
        temperature: 0.7
      });
      
      if (global.VERBOSE_MODE) {
        console.log(chalk.gray('Response received from Claude API'));
        console.log(chalk.gray(`Response length: ${response.content[0].text.length} characters`));
      }
      
      return {
        content: response.content[0].text,
        usage: response.usage
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
}

module.exports = { ClaudeAPI };
