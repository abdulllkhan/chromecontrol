// Test for custom prompt prioritization in AI services
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../aiService.js';
import { ClaudeService } from '../claudeService.js';
import {
    AIRequest,
    WebsiteContext,
    WebsiteCategory,
    PageType,
    SecurityLevel,
    TaskType,
    OutputFormat
} from '../../types/index.js';

describe('Custom Prompt Prioritization', () => {
    let mockWebsiteContext: WebsiteContext;
    let baseAIRequest: AIRequest;

    beforeEach(() => {
        mockWebsiteContext = {
            domain: 'example.com',
            category: WebsiteCategory.PRODUCTIVITY,
            pageType: PageType.ARTICLE,
            extractedData: { title: 'Test Article' },
            securityLevel: SecurityLevel.PUBLIC,
            timestamp: new Date()
        };

        baseAIRequest = {
            prompt: 'Custom task prompt: Analyze {{domain}} for productivity insights',
            context: mockWebsiteContext,
            taskType: TaskType.ANALYZE_CONTENT,
            outputFormat: OutputFormat.MARKDOWN,
            constraints: {
                allowSensitiveData: false,
                maxContentLength: 10000,
                allowedDomains: ['example.com'],
                restrictedSelectors: []
            },
            timestamp: new Date()
        };
    });

    describe('OpenAI Service (AIService)', () => {
        let aiService: AIService;

        beforeEach(() => {
            aiService = new AIService({
                apiKey: 'test-key',
                provider: 'openai'
            });

            // Mock the makeAPICall method to avoid actual API calls
            vi.spyOn(aiService as any, 'makeAPICall').mockResolvedValue({
                choices: [{
                    message: {
                        content: 'Test response'
                    }
                }]
            });
        });

        it('should use custom prompt as primary instruction when taskId is provided', async () => {
            const customRequest: AIRequest = {
                ...baseAIRequest,
                taskId: 'custom-task-123'
            };

            // Spy on buildPrompt method to check the final prompt
            const buildPromptSpy = vi.spyOn(aiService as any, 'buildPrompt');

            try {
                await aiService.processRequest(customRequest);
            } catch (error) {
                // Ignore API errors, we just want to check the prompt building
            }

            expect(buildPromptSpy).toHaveBeenCalledWith(customRequest);

            // Get the actual prompt that was built
            const builtPrompt = buildPromptSpy.mock.results[0]?.value;
            expect(builtPrompt).toBeDefined();

            // The custom prompt should be at the beginning (primary instruction)
            expect(builtPrompt).toMatch(/^Custom task prompt: Analyze/);

            // Should contain context information but not system prompt
            expect(builtPrompt).toContain('Current Page Context:');
            expect(builtPrompt).toContain('Domain: example.com');

            // Should NOT start with system prompt when taskId is provided
            expect(builtPrompt).not.toMatch(/^You are an AI assistant/);
        });

        it('should use system prompt when taskId is NOT provided', async () => {
            const genericRequest: AIRequest = {
                ...baseAIRequest
                // No taskId provided
            };

            // Spy on buildPrompt method to check the final prompt
            const buildPromptSpy = vi.spyOn(aiService as any, 'buildPrompt');

            try {
                await aiService.processRequest(genericRequest);
            } catch (error) {
                // Ignore API errors, we just want to check the prompt building
            }

            expect(buildPromptSpy).toHaveBeenCalledWith(genericRequest);

            // Get the actual prompt that was built
            const builtPrompt = buildPromptSpy.mock.results[0]?.value;
            expect(builtPrompt).toBeDefined();

            // Should start with system prompt for generic requests
            expect(builtPrompt).toMatch(/^You are an AI assistant/);

            // Should contain the user prompt at the end
            expect(builtPrompt).toContain('Custom task prompt: Analyze {{domain}} for productivity insights');
        });
    });

    describe('Claude Service', () => {
        let claudeService: ClaudeService;

        beforeEach(() => {
            claudeService = new ClaudeService({
                apiKey: 'test-key'
            });

            // Mock the makeClaudeAPICall method to avoid actual API calls
            vi.spyOn(claudeService as any, 'makeClaudeAPICall').mockResolvedValue({
                content: [{
                    text: 'Test response'
                }]
            });
        });

        it('should use custom prompt as primary instruction when taskId is provided', async () => {
            const customRequest: AIRequest = {
                ...baseAIRequest,
                taskId: 'custom-task-123'
            };

            // Spy on buildPrompt method to check the final prompt
            const buildPromptSpy = vi.spyOn(claudeService as any, 'buildPrompt');

            try {
                await claudeService.processRequest(customRequest);
            } catch (error) {
                // Ignore API errors, we just want to check the prompt building
            }

            expect(buildPromptSpy).toHaveBeenCalledWith(customRequest);

            // Get the actual prompt that was built
            const builtPrompt = buildPromptSpy.mock.results[0]?.value;
            expect(builtPrompt).toBeDefined();

            // The custom prompt should be at the beginning (primary instruction)
            expect(builtPrompt).toMatch(/^Custom task prompt: Analyze/);

            // Should contain context information but not system prompt
            expect(builtPrompt).toContain('Current Page Context:');
            expect(builtPrompt).toContain('Domain: example.com');

            // Should NOT start with system prompt when taskId is provided
            expect(builtPrompt).not.toMatch(/^You are an AI assistant/);
        });

        it('should use system prompt when taskId is NOT provided', async () => {
            const genericRequest: AIRequest = {
                ...baseAIRequest
                // No taskId provided
            };

            // Spy on buildPrompt method to check the final prompt
            const buildPromptSpy = vi.spyOn(claudeService as any, 'buildPrompt');

            try {
                await claudeService.processRequest(genericRequest);
            } catch (error) {
                // Ignore API errors, we just want to check the prompt building
            }

            expect(buildPromptSpy).toHaveBeenCalledWith(genericRequest);

            // Get the actual prompt that was built
            const builtPrompt = buildPromptSpy.mock.results[0]?.value;
            expect(builtPrompt).toBeDefined();

            // Should start with system prompt for generic requests (Claude format)
            expect(builtPrompt).toMatch(/^You are Claude, an AI assistant/);

            // Should contain the user prompt at the end
            expect(builtPrompt).toContain('Custom task prompt: Analyze {{domain}} for productivity insights');
        });
    });

    describe('Prompt Building Logic Comparison', () => {
        it('should have identical logic between OpenAI and Claude services', () => {
            const aiService = new AIService({ apiKey: 'test', provider: 'openai' });
            const claudeService = new ClaudeService({ apiKey: 'test' });

            // Test with taskId (custom task)
            const customRequest: AIRequest = {
                ...baseAIRequest,
                taskId: 'test-task'
            };

            const openAIPrompt = (aiService as any).buildPrompt(customRequest);
            const claudePrompt = (claudeService as any).buildPrompt(customRequest);

            // Both should start with the custom prompt
            expect(openAIPrompt).toMatch(/^Custom task prompt: Analyze/);
            expect(claudePrompt).toMatch(/^Custom task prompt: Analyze/);

            // Both should contain context
            expect(openAIPrompt).toContain('Current Page Context:');
            expect(claudePrompt).toContain('Current Page Context:');

            // Test without taskId (generic request)
            const genericRequest: AIRequest = {
                ...baseAIRequest
                // No taskId
            };

            const openAIGenericPrompt = (aiService as any).buildPrompt(genericRequest);
            const claudeGenericPrompt = (claudeService as any).buildPrompt(genericRequest);

            // Both should start with system prompt (but Claude has different format)
            expect(openAIGenericPrompt).toMatch(/^You are an AI assistant/);
            expect(claudeGenericPrompt).toMatch(/^You are Claude, an AI assistant/);
        });
    });
});