async function createSystemPromptWithResearch(phase) {
  // Load the base system prompt
  let systemPrompt = await this.frameworkLoader.loadSystemPrompt(phase);
  
  // Add research insights if available
  if (this.phaseData[PHASES.INTAKE].data.researchInsights) {
    const insights = this.phaseData[PHASES.INTAKE].data.researchInsights;
    
    if (insights.length > 0) {
      systemPrompt += "\n\n## WEB RESEARCH INSIGHTS\n\n";
      
      insights.forEach(insight => {
          if (insight.summary && insight.summary.length > 0) {
            insight.summary.forEach(point => {
              systemPrompt += `- ${point}\n`;
            });
            systemPrompt += "\n";
          }
      });
        
        // Add guidance on using research
        systemPrompt += `
        ## PERSONALITY EMPHASIS REMINDER

IMPORTANT: This review MUST have a strong personality and appropriate humor. The default level should be 3 on a 5-point scale (Personality-Forward: Clear voice, regular humor, distinctive style).

- Include at least one unexpected analogy or absurd specificity element
- Front-load information but ensure EVERY paragraph has personality elements
- Section titles should use creative, thematic elements whenever possible


Remember: Users consistently prefer reviews with MORE personality and humor than less. When in doubt, add more personality elements (while keeping information accurate).

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
  
  IMPORTANT: Use the web research insights above to enhance the review, but:
1. Do not fabricate specific user experiences that weren't mentioned by the human
2. Use research to provide context, technical details, and comparison points
3. Blend research naturally into the review without directly copying phrases
4. Prioritize the human's actual experiences and observations over research
5. Use research primarily for filling gaps and providing additional context
  `;
      }
    }
    // For refinement phase, add specialized guidelines
  if (phase === 'refine') {
    // Load all refining guidelines
    const guidelines = await this.frameworkLoader.getRefiningGuidelines();
    
    if (Object.keys(guidelines).length > 0) {
      // Add personality and humor section
      if (guidelines.humorFramework || guidelines.personalityTechniques) {
        systemPrompt += "\n\n## PERSONALITY ENHANCEMENT GUIDANCE\n\n";
        systemPrompt += "When adding humor or personality, consider these approaches:\n\n";
        
        // Format humor framework
        if (guidelines.humorFramework?.humor_techniques?.approaches) {
          systemPrompt += "### Recommended Humor Techniques:\n";
          guidelines.humorFramework.humor_techniques.approaches.forEach(technique => {
            systemPrompt += `- **${technique.technique}**: ${technique.description}\n`;
            if (technique.example) {
              systemPrompt += `  Example: "${technique.example}"\n`;
            }
          });
          systemPrompt += "\n";
        }
        
        // Add personality techniques
        if (guidelines.personalityTechniques?.creative_elements) {
          systemPrompt += "### Creative Elements for Personality:\n";
          guidelines.personalityTechniques.creative_elements.forEach(element => {
            systemPrompt += `- **${element.name}**: ${element.description}\n`;
            if (element.example) {
              systemPrompt += `  Example: "${element.example}"\n`;
            }
          });
          systemPrompt += "\n";
        }
        
        // Add information on balancing
        if (guidelines.informationPersonalityBalance) {
          systemPrompt += "### Maintaining Information/Personality Balance:\n";
          systemPrompt += `- Baseline ratio: ${guidelines.informationPersonalityBalance.baseline_ratios.informational}% information, ${guidelines.informationPersonalityBalance.baseline_ratios.personality}% personality\n`;
          systemPrompt += "- Always place essential information FIRST in every sentence or list item\n";
          systemPrompt += "- Enhance 30-40% of list items with personality, always after core information\n\n";
        }
        
        // Add balance disruption guidance
        if (guidelines.balanceDisruption) {
          systemPrompt += "### Avoiding Balance Disruption:\n";
          systemPrompt += `${guidelines.balanceDisruption.description}\n`;
          guidelines.balanceDisruption.prevention.forEach(tip => {
            systemPrompt += `- ${tip}\n`;
          });
          systemPrompt += "\n";
        }
      }
      
      // Add formatting guidelines
      if (guidelines.formattingGuidelines) {
        systemPrompt += "\n\n## FORMATTING GUIDELINES\n\n";
        guidelines.formattingGuidelines.forEach(guideline => {
          systemPrompt += `- ${guideline}\n`;
        });
        systemPrompt += "\n";
      }
      
      // Add redundancy prevention
      if (guidelines.redundancyReview) {
        systemPrompt += "\n\n## REDUNDANCY PREVENTION\n\n";
        
        // Add section specialization
        if (guidelines.redundancyReview.section_specialization) {
          systemPrompt += "### Section Specialization:\n";
          guidelines.redundancyReview.section_specialization.forEach(item => {
            systemPrompt += `- [${item.priority}] ${item.guideline}\n`;
          });
          systemPrompt += "\n";
        }
        
        // Add resolution strategies
        if (guidelines.redundancyReview.resolution_strategies) {
          systemPrompt += "### Resolving Redundancy:\n";
          
          // Optimal placement
          const optimalPlacement = guidelines.redundancyReview.resolution_strategies.optimal_placement;
          if (optimalPlacement) {
            systemPrompt += `- **${optimalPlacement.description}**:\n`;
            optimalPlacement.implementation.forEach(step => {
              systemPrompt += `  - ${step}\n`;
            });
            systemPrompt += "\n";
          }
          
          // Dimension addition
          const dimensionAddition = guidelines.redundancyReview.resolution_strategies.dimension_addition;
          if (dimensionAddition) {
            systemPrompt += `- **${dimensionAddition.description}**:\n`;
            dimensionAddition.implementation.forEach(step => {
              systemPrompt += `  - ${step}\n`;
            });
            systemPrompt += "\n";
          }
        }
      }
    }
  }
  
  return systemPrompt;
}
