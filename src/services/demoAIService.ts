/**
 * Demo AI Service
 * 
 * Provides demo responses when no real AI service is configured
 */

import { AIRequest, AIResponse, TaskType, OutputFormat } from '../types/index.js';

export class DemoAIService {
  /**
   * Process a demo AI request with simulated responses
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const demoResponses = this.getDemoResponses(request);
    const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];

    return {
      content: randomResponse,
      format: request.outputFormat,
      confidence: 0.8,
      timestamp: new Date(),
      requestId: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Validate demo response (always returns true)
   */
  validateResponse(response: AIResponse): boolean {
    return true;
  }

  /**
   * Get demo responses based on task type and context
   */
  private getDemoResponses(request: AIRequest): string[] {
    const { taskType, context, prompt } = request;

    // Base responses by task type
    const baseResponses: Record<TaskType, string[]> = {
      [TaskType.GENERATE_TEXT]: [
        "This is a demo response for text generation. In the full version, AI would analyze your request and generate contextual content based on the current website and your specific needs.",
        "Demo mode: AI would create relevant content here. Configure your OpenAI API key to unlock real AI-powered suggestions and content generation.",
        "Sample generated content would appear here. The AI service can help with writing, summarizing, and creating content tailored to your current context."
      ],
      [TaskType.ANALYZE_CONTENT]: [
        `Demo analysis of ${context.domain}: This website appears to be in the ${context.category} category. In full mode, AI would provide detailed insights about the page content, structure, and recommendations.`,
        "Content analysis demo: The AI would examine the current page and provide insights about its purpose, key information, and potential actions you could take.",
        "Demo insight: This page contains various elements that could be analyzed for better understanding. Real AI analysis would provide specific, actionable insights."
      ],
      [TaskType.AUTOMATE_ACTION]: [
        "Demo automation: AI would provide step-by-step instructions for automating tasks on this website. Configure AI to unlock real automation capabilities.",
        "Automation demo: The system would analyze the page and suggest specific actions you could automate, like filling forms or clicking buttons.",
        "Demo workflow: AI would create a sequence of actions to help you accomplish your goals on this website more efficiently."
      ],
      [TaskType.EXTRACT_DATA]: [
        `Demo data extraction from ${context.domain}: AI would identify and extract relevant information from this page in a structured format.`,
        "Data extraction demo: The AI would scan the page and pull out key information like prices, dates, names, or other relevant data points.",
        "Demo extraction: AI would organize the page content into useful, structured data that you could copy or use elsewhere."
      ]
    };

    // Add context-specific responses
    const contextResponses: string[] = [];
    
    if (context.category === 'social_media') {
      contextResponses.push(
        "Demo social media insight: AI would help you create engaging posts, analyze trends, or suggest hashtags for this platform.",
        "Social media demo: The AI could help you craft better content, understand engagement patterns, or optimize your social presence."
      );
    } else if (context.category === 'ecommerce') {
      contextResponses.push(
        "Demo e-commerce analysis: AI would help you compare products, find better deals, or analyze reviews on this shopping site.",
        "Shopping demo: The AI could extract product information, compare prices, or help you make informed purchasing decisions."
      );
    } else if (context.category === 'professional') {
      contextResponses.push(
        "Demo professional assistance: AI would help you optimize your profile, write better applications, or analyze job opportunities.",
        "Career demo: The AI could help you improve your professional presence, write cover letters, or understand job requirements."
      );
    } else if (context.category === 'news_content') {
      contextResponses.push(
        "Demo content analysis: AI would summarize articles, fact-check information, or provide different perspectives on the news.",
        "News demo: The AI could help you quickly understand key points, verify information, or get summaries of long articles."
      );
    }

    // Combine base responses with context-specific ones
    const allResponses = [...baseResponses[taskType], ...contextResponses];
    
    // Add a note about demo mode
    return allResponses.map(response => 
      `🤖 DEMO MODE: ${response}\n\n💡 To unlock full AI capabilities, configure your OpenAI API key in the AI settings.`
    );
  }

  /**
   * Check if this is a demo service
   */
  isDemoMode(): boolean {
    return true;
  }
}

export const demoAIService = new DemoAIService();