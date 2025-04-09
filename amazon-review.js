#!/usr/bin/env node
/**
 * Amazon Review Framework CLI Tool
 * Main entry point for the command-line interface
 */

require('dotenv').config();
const { program } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const { Session } = require('./src/session-class');
const { listSessions, createNewSession, loadExistingSession } = require('./src/cli');
const { version } = require('./package.json');

// Display banner
console.log(
  chalk.cyan(
    figlet.textSync('Amazon Review', { horizontalLayout: 'full' })
  )
);
console.log(chalk.cyan('Framework CLI Tool\n'));

// Verify API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(chalk.red('Error: ANTHROPIC_API_KEY not found in environment variables.'));
  console.log(chalk.yellow('Please create a .env file with your Anthropic API key.'));
  console.log(chalk.yellow('Example: ANTHROPIC_API_KEY=sk-ant-api03-...'));
  process.exit(1);
}


// Set up command-line options
program
  .version(version)
  .description('A CLI tool for creating exceptional product reviews using the Amazon Review Framework')
  .option('-n, --new', 'Start a new review session')
  .option('-c, --continue <id>', 'Continue an existing review session')
  .option('-l, --list', 'List all saved review sessions')
  .option('-d, --directory <path>', 'Set custom directory for images', './images')
  .option('-v, --verbose', 'Enable verbose output for debugging')
  .parse(process.argv);

const options = program.opts();

// Set verbose mode globally
if (options.verbose) {
  global.VERBOSE_MODE = true;
  console.log(chalk.yellow('Verbose mode enabled'));
}

// Main function to handle command-line options
async function main() {
  try {
    if (options.list) {
      // List all saved sessions
      await listSessions();
      process.exit(0);
    } 
    else if (options.continue) {
      // Continue existing session
      const session = await loadExistingSession(options.continue);
      if (session) {
        await session.start();
      }
    } 
    else if (options.new) {
      // Start new session
      const session = await createNewSession(options.directory);
      await session.start();
    } 
    else {
      // If no options provided, show interactive menu
      const sessionAction = await promptSessionAction();
      
      if (sessionAction === 'new') {
        const session = await createNewSession(options.directory);
        await session.start();
      } 
      else if (sessionAction === 'continue') {
        const sessionId = await promptSessionSelection();
        if (sessionId) {
          const session = await loadExistingSession(sessionId);
          if (session) {
            await session.start();
          }
        }
      } 
      else if (sessionAction === 'list') {
        await listSessions();
        main(); // Return to main menu after listing
      }
      else if (sessionAction === 'exit') {
        console.log(chalk.green('Thank you for using the Amazon Review Framework CLI!'));
        process.exit(0);
      }
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    if (global.VERBOSE_MODE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Function to prompt for session action
async function promptSessionAction() {
  const inquirer = require('inquirer');
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Start a new review', value: 'new' },
        { name: 'Continue an existing review', value: 'continue' },
        { name: 'List saved reviews', value: 'list' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  
  return action;
}

// Function to prompt for session selection
async function promptSessionSelection() {
  const sessions = await Session.getAllSessions();
  
  if (sessions.length === 0) {
    console.log(chalk.yellow('No saved sessions found.'));
    return null;
  }
  
  const inquirer = require('inquirer');
  const { sessionId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sessionId',
      message: 'Select a session to continue:',
      choices: sessions.map(session => ({
        name: `${session.productName} (${session.phase}) - Created: ${new Date(session.createdAt).toLocaleString()}`,
        value: session.id
      }))
    }
  ]);
  
  return sessionId;
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error.message);
  if (global.VERBOSE_MODE) {
    console.error(error.stack);
  }
  process.exit(1);
});

