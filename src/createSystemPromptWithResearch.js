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
  CRITICAL UPDATE TO FRAMEWORK INSTRUCTIONS:
  
  The above research insights contain two types of information:
  1. FACTUAL INFORMATION: Technical specifications, compatibility details, measurements, and objective facts
  2. SUBJECTIVE INFORMATION: Opinions, experiences, and preferences reported by other users
  
  When creating the review:
  
  For FACTUAL INFORMATION:
  - Integrate factual research seamlessly into the review
  - Present technical specifications, compatibility details, and objective measurements as verified facts
  - Use this information to provide context and depth to the user's experiences
  
  For SUBJECTIVE INFORMATION:
  - Never present other users' opinions or subjective experiences as if they were the user's own
  - When including subjective information from research, always attribute it clearly as third-party opinions
  - Use phrases like "according to other users," "many reviewers note that," or "a common experience reported by others"
  - Include subjective information only when it provides valuable context or fills gaps not covered by the user's direct experience
  
  PRIORITY: The user's direct experiences always take precedence over any conflicting information from research.
  
  IMPORTANT: This research has been explicitly authorized by the user for incorporation into the review, but must be handled according to these guidelines.
  `;
      }
    }
    
    return systemPrompt;
  }