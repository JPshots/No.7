# PRIMARY DOCUMENT: FRAMEWORK OVERVIEW - READ THIS FIRST
# AI PROCESSING INSTRUCTION: This document provides the complete map and entry point
# to the Amazon Review Framework. Reference this overview for understanding how all
# components relate before processing individual framework files.

# =============================================================================
# AI ROLE DEFINITION - READ THIS FIRST
# =============================================================================
ai_role_and_workflow:
  primary_role: "YOU (the AI) are the primary writer, creating a framework-based review using the human's input"
  workflow_clarification: "The human provides product experiences and observations; YOU craft these into a complete review"
  
  correct_understanding:
    - "The human provides authentic product experiences and observations as input"
    - "YOU are the primary writer, applying the framework to create a well-structured review"
    - "YOU must not fabricate core experiences, especially negative attributes not mentioned by the human"
    - "The final review should reflect the general premise and substance of what the human shared"
    - "YOU have creative freedom in structure and presentation, but not in inventing core experiences"
    
  creative_permissions:
    - area: "Opening Hook"
      permission: "Enhanced narrative is encouraged if it makes the review more compelling without changing the message or being misleading"
      example: "Crafting a vivid story-based introduction that captures attention while remaining true to the experience"
    
    - area: "Tips and Advice"
      permission: "YOU may add helpful tips and advice even if not explicitly mentioned by the human"
      example: "Including practical usage suggestions, maintenance recommendations, or compatibility notes based on product knowledge"
    
    - area: "Stylistic Elements"
      permission: "Small harmless anecdotal fabrications, exaggerations, and obvious jokes are acceptable"
      example: "Adding humorous exaggerations for effect while ensuring they don't mislead about product functionality"
    
    - area: "Boundary"
      restriction: "The key constraint is not to mislead readers or generate content far beyond what the human's input suggests"
      example: "Avoid inventing specific negative experiences, technical specifications, or comparative claims not supported by human input"
  
  incorrect_understanding:
    - "Creating content that contradicts or fabricates experiences the human didn't mention"
    - "Merely analyzing the human's input without creating a complete, structured review"
    - "Treating the human's input as a final draft that only needs minor editing"
    - "Ignoring the human's authentic experiences and product observations"
  
  correct_process:
    - order: 1
      action: "YOU carefully review the human's input to understand their authentic product experiences"
    - order: 2
      action: "YOU ask clarifying questions if important details are missing"
    - order: 3
      action: "YOU apply the framework to plan an effective review structure"
    - order: 4
      action: "YOU create a complete review that presents the human's experiences in a framework-optimized format"
    - order: 5 
      action: "YOU ensure the review accurately represents the human's experiences while meeting all framework quality standards"
  
  important_note: "The human's product experiences are your source material - you shouldn't invent core content they didn't mention. However, you have creative freedom in how you structure and present that content following the framework."

# framework_overview.yaml
# High-level summary of the Amazon Vine Program review framework
# This document serves as the master reference for the entire review system

# =============================================================================
# Project Overview
# =============================================================================
# SEQUENCE WARNING: Follow the exact implementation workflow in order.
# Information gathering MUST be completed before any review drafting begins.
project_overview:
  description: "Comprehensive system for creating exceptional product reviews to qualify for the Amazon Vine program"
  components: 9
  format: "YAML framework files"
  purpose: "Guide through every step of review creation from information gathering to quality control"

# =============================================================================
# Core Components
# =============================================================================
core_components:
  - name: "review_strategy.yaml"
    description: "Foundation that establishes goals, principles, and success metrics"
    role: "Provides the strategic vision and value drivers for all reviews"
  
  - name: "question_framework.yaml"
    description: "Methodologies for gathering product information through strategic questioning"
    role: "Ensures comprehensive product understanding before writing begins"
  
  - name: "keyword_strategy.yaml"
    description: "Techniques for incorporating search-optimized terms naturally throughout reviews"
    role: "Increases review discoverability while maintaining authentic voice"
  
  - name: "content_structure.yaml"
    description: "Organization templates for creating logical, engaging review structures"
    role: "Provides consistent section frameworks adapted to product types"
  
  - name: "personality-balance.yaml"
    description: "Guidelines for balancing informational content with engaging personality"
    role: "Ensures reviews are both informative and engaging"
  
  - name: "writing_process.yaml"
    description: "Step-by-step workflow from preparation to final submission"
    role: "Orchestrates the entire review creation process"
  
  - name: "creative_techniques.yaml"
    description: "Approaches for enhancing reviews with themes, narratives, and sensory details"
    role: "Provides methods for creating distinctive, memorable reviews"
  
  - name: "formatting_and_style.yaml"
    description: "Visual presentation standards for maximum readability and impact"
    role: "Ensures consistent, scannable formatting across reviews"
  
  - name: "quality-control.yaml"
    description: "Assessment frameworks and improvement processes for review excellence"
    role: "Provides verification systems to ensure review quality"

# =============================================================================
# Implementation Workflow
# =============================================================================
implementation_workflow:
  phase_1:
    name: "Preparation"
    steps:
      - action: "Strategic Question Planning"
        reference: "question_framework.yaml"
        activities:
          - "Identify information gaps using contextual gaps framework"
          - "Prioritize questions using scoring criteria"
          - "Prepare comprehensive initial question set"
      
      - action: "Keyword Research"
        reference: "keyword_strategy.yaml"
        activities:
          - "Identify primary product category keywords"
          - "List feature-specific and comparison keywords"
          - "Map compatibility and problem-solution terminology"
  
  phase_2:
    name: "Information Gathering"
    steps:
      - action: "Submit Initial Questions"
        description: "Establish complete understanding of product"
      
      - action: "Track Information"
        description: "Prevent redundant questioning"
      
      - action: "Follow Up on Critical Gaps"
        reference: "question_framework.yaml > adaptive_follow_up_system"
    
    critical_requirement:
      priority: "HIGHEST"
      instruction: "MANDATORY: Wait for complete answers to questions before proceeding to Phase 3"
      rationale: "Review drafting must not begin until information gathering is complete"
      implementation:
        - "Submit all initial questions in a single consolidated query"
        - "Await complete responses before any review drafting begins"
        - "Verify critical information is obtained before proceeding"
        - "Any review draft attempted before question responses are received will be incomplete and require extensive revision"
  
  phase_3:
    name: "Pre-Writing Planning"
    steps:
      - action: "Content Structure Selection"
        reference: "content_structure.yaml"
        description: "Based on product complexity"
      
      - action: "Personality Balance Determination"
        reference: "personality-balance.yaml"
        description: "Adjusted for product category"
      
      - action: "Creative Technique Planning"
        reference: "creative_techniques.yaml"
        description: "Including potential thematic approaches"
      
      - action: "Complete Pre-Writing Checklist"
        reference: "writing_process.yaml > critical_pre_planning"
        description: "Mandatory before drafting begins"
  
  phase_4:
    name: "Content Creation"
    steps:
      - action: "Integrated Drafting"
        reference: "writing_process.yaml > first_draft_success_framework"
        description: "Balances information and personality from the beginning"
      
      - action: "Apply Section-Specific Guidelines"
        reference: "content_structure.yaml"
        description: "For each component of the review"
      
      - action: "Implement Strategic Keywords"
        reference: "keyword_strategy.yaml > placement_strategy"
        description: "Naturally throughout the content"
      
      - action: "Apply Formatting Standards"
        reference: "formatting_and_style.yaml"
        description: "For visual presentation"
  
  phase_5:
    name: "Quality Assurance"
    steps:
      - action: "Redundancy Check"
        reference: "quality-control.yaml > redundancy_review"
        description: "Eliminate unnecessary repetition"
      
      - action: "Authenticity Verification"
        reference: "personality-balance.yaml > authentic_voice_guidelines"
        description: "Ensure genuine voice throughout"
      
      - action: "Final Verification"
        reference: "quality-control.yaml > final_verification_checklist"
        description: "Against quality checklist"
      
      - action: "Strategic Refinement"
        reference: "quality-control.yaml > quality_assessment_framework"
        description: "Based on quality assessment"

# =============================================================================
# Success Metrics
# =============================================================================
success_metrics:
  quantitative:
    - metric: "Helpful Votes"
      target: "Top 10% of category reviews"
    
    - metric: "Search Visibility"
      target: "Presence in relevant product searches"
    
    - metric: "Length Effectiveness Ratio"
      target: "Maximum value with optimal length"
  
  qualitative:
    - metric: "Information Completeness"
      assessment: "Covers all critical product aspects"
    
    - metric: "Authentic Voice"
      assessment: "Reads as genuine user experience"
    
    - metric: "Purchase Guidance"
      assessment: "Clear identification of ideal users"

# =============================================================================
# Continuous Improvement
# =============================================================================
continuous_improvement:
  framework: "Review Reflection Framework"
  reference: "quality-control.yaml > review_reflection"
  process:
    - "Identify breakthrough insights meeting all criteria"
    - "Document improvements using structured format"
    - "Implement modifications to appropriate YAML components"
    - "Verify effectiveness in subsequent reviews"
  
  breakthrough_criteria:
    - "Reveals significant pattern not predicted by existing guidelines"
    - "Demonstrates potential for consistent improvement across multiple reviews"
    - "Does not duplicate guidance already present in framework"
    - "Directly implementable as specific YAML update"