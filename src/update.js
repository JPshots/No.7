/**
 * Conduct product research during the Intake phase with enhanced research planner
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
    const { useResearch, importance } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useResearch',
        message: 'Would you like to use web search to enhance your review? (Budget: $0.85)',
        default: true
      },
      {
        type: 'list',
        name: 'importance',
        message: 'How important is extensive research for this review?',
        choices: [
          { name: 'Low - Just basic facts', value: 'low' },
          { name: 'Medium - Standard research', value: 'medium' },
          { name: 'High - Comprehensive research', value: 'high' }
        ],
        default: 'medium',
        when: (answers) => answers.useResearch
      }
    ]);
    
    if (!useResearch) {
      console.log(chalk.yellow('Skipping enhanced research.'));
      return false;
    }
    
    try {
      // Determine product type if not already set
      if (!this.productType) {
        const { detectedType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'detectedType',
            message: 'What type of product is this?',
            choices: [
              'electronics',
              'kitchen',
              'clothing',
              'beauty',
              'tool',
              'toy',
              'book',
              'software',
              'generic'
            ],
            default: 'generic'
          }
        ]);
        
        this.productType = detectedType;
      }
      
      // Initialize the enhanced research planner
      const researchPlanner = new EnhancedResearchPlanner(
        this.claude,
        this.productName,
        this.productType,
        importance
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
        const additionalQuestions = await researchPlanner.generateQuestionsFromGapAnalysis(researchResults.gapAnalysis);
        
        // Ask user if they want to answer these questions
        if (additionalQuestions.length > 0) {
          console.log(chalk.cyan("\n=== ADDITIONAL QUESTIONS BASED ON RESEARCH ==="));
          console.log(chalk.yellow(`Research identified ${additionalQuestions.length} questions that could enhance your review.`));
          
          const { answerQuestions } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'answerQuestions',
              message: 'Would you like to answer these research-based questions?',
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