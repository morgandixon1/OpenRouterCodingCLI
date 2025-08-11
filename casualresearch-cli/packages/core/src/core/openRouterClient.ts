/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';

export class OpenRouterClient implements ContentGenerator {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string;

  // Models that support function/tool calling
  private toolSupportedModels: Set<string> = new Set([
    // OpenAI models
    'openai/gpt-4o',
    'openai/gpt-4o-mini', 
    'openai/gpt-4-turbo',
    'openai/gpt-4',
    'openai/gpt-3.5-turbo',
    // Anthropic models
    'anthropic/claude-3-5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet', 
    'anthropic/claude-3-haiku',
    'anthropic/claude-3.5-sonnet:beta',
    // Google models
    'google/gemini-pro',
    'google/gemini-1.5-pro',
    'google/gemini-1.5-flash',
    'google/gemini-2.0-flash-exp',
    // Mistral models
    'mistral/mistral-large',
    'mistral/mistral-medium',
    'mistralai/mistral-large-2407',
    // Other models that support tools
    'cohere/command-r-plus',
    'meta-llama/llama-3.2-90b-instruct',
    'openrouter/auto', // OpenRouter's auto-routing may select tool-capable models
  ]);

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private supportsTools(): boolean {
    // Check if current model supports tool/function calling
    return this.toolSupportedModels.has(this.model);
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    // Convert the request format to OpenRouter's expected format
    const messages = this.convertToOpenRouterFormat(request);
    const tools = this.convertToolsToOpenRouterFormat(request.config?.tools);
    
    // Debug logging
    console.log('OpenRouter API request:', {
      model: this.model,
      messages: messages,
      tools: tools,
      apiKeyPresent: !!this.apiKey
    });
    
    const requestBody: any = {
      model: this.model,
      messages,
      stream: false,
    };

    // Include tools if they exist - all models should be capable of following tool format instructions
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/casualresearch/casualresearch-cli',
        'X-Title': 'CasualResearch CLI',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `OpenRouter API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
        }
      } catch (e) {
        // If we can't parse the error response, use the original message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Convert OpenRouter response to GoogleGenAI format
    const result = this.convertFromOpenRouterFormat(data);
    if (result === null) {
      throw new Error('Failed to convert OpenRouter response');
    }
    return result;
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.createStreamGenerator(request, userPromptId);
  }

  private async *createStreamGenerator(
    request: GenerateContentParameters,
    userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    // Convert the request format to OpenRouter's expected format
    const messages = this.convertToOpenRouterFormat(request);
    const tools = this.convertToolsToOpenRouterFormat(request.config?.tools);
    
    const requestBody: any = {
      model: this.model,
      messages,
      stream: true,
    };

    // Include tools if they exist - all models should be capable of following tool format instructions
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/casualresearch/casualresearch-cli',
        'X-Title': 'CasualResearch CLI',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `OpenRouter API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
        }
      } catch (e) {
        // If we can't parse the error response, use the original message
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              return;
            }
            
            try {
              const data = JSON.parse(jsonStr);
              const converted = this.convertFromOpenRouterFormat(data, true);
              if (converted !== null) {
                yield converted;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // OpenRouter doesn't have a direct token counting endpoint
    // Return a rough estimate based on content length
    const content = JSON.stringify(request.contents);
    const estimatedTokens = Math.ceil(content.length / 4); // Rough estimation
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // OpenRouter doesn't provide embedding functionality in the same way
    throw new Error('Embedding not supported by OpenRouter client');
  }

  private convertToolsToOpenRouterFormat(tools?: any[]): any[] {
    if (!tools || tools.length === 0) {
      return [];
    }

    const openRouterTools: any[] = [];

    for (const tool of tools) {
      // Handle Gemini Tool format: { functionDeclarations: FunctionDeclaration[] }
      if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
        for (const funcDecl of tool.functionDeclarations) {
          openRouterTools.push({
            type: 'function',
            function: {
              name: funcDecl.name,
              description: funcDecl.description || '',
              parameters: funcDecl.parameters || {},
            },
          });
        }
      }
    }

    return openRouterTools;
  }

  private convertToOpenRouterFormat(request: GenerateContentParameters): any[] {
    const messages: any[] = [];
    
    console.log('Converting request contents:', JSON.stringify(request.contents, null, 2));
    
    // Add system instruction as the first message if it exists
    if (request.config?.systemInstruction) {
      let systemContent = '';
      if (typeof request.config.systemInstruction === 'string') {
        systemContent = request.config.systemInstruction;
      } else if (typeof request.config.systemInstruction === 'object' && 'parts' in request.config.systemInstruction && request.config.systemInstruction.parts) {
        systemContent = request.config.systemInstruction.parts.map((part: any) => part.text).join('\n');
      }
      
      if (systemContent) {
        messages.push({
          role: 'system',
          content: systemContent,
        });
      }
    }
    
    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        // Handle different content types properly
        if (typeof content === 'object' && 'role' in content && 'parts' in content) {
          if (content.role === 'user') {
            const parts = content.parts || [];
            const textParts = parts.filter((part: any) => part.text).map((part: any) => part.text).join('\n');
            if (textParts) {
              messages.push({
                role: 'user',
                content: textParts,
              });
            }
          } else if (content.role === 'model') {
            const parts = content.parts || [];
            const textParts = parts.filter((part: any) => part.text).map((part: any) => part.text).join('\n');
            if (textParts) {
              messages.push({
                role: 'assistant',
                content: textParts,
              });
            }
          }
        } else if (typeof content === 'string') {
          // Handle string content
          messages.push({
            role: 'user',
            content: content,
          });
        }
      }
    }
    
    // If no messages were converted, create a default user message
    if (messages.length === 0) {
      console.warn('No messages converted, creating default message');
      messages.push({
        role: 'user',
        content: 'Hello',
      });
    }
    
    console.log('Converted messages:', JSON.stringify(messages, null, 2));
    return messages;
  }

  private convertFromOpenRouterFormat(data: any, isStreaming: boolean = false): GenerateContentResponse | null {
    if (isStreaming) {
      const delta = data.choices?.[0]?.delta;
      
      // Handle tool calls in streaming mode
      if (delta?.tool_calls) {
        const parts = delta.tool_calls.map((toolCall: any) => ({
          functionCall: {
            name: toolCall.function?.name || '',
            args: JSON.parse(toolCall.function?.arguments || '{}')
          }
        }));
        
        return {
          candidates: [{
            content: {
              parts,
              role: 'model',
            },
            finishReason: data.choices?.[0]?.finish_reason || undefined,
          }],
          text: '',
          data: '',
          functionCalls: parts.map((p: any) => p.functionCall),
          executableCode: [],
          codeExecutionResult: [],
        } as unknown as GenerateContentResponse;
      }
      
      if (delta?.content) {
        return {
          candidates: [{
            content: {
              parts: [{ text: delta.content }],
              role: 'model',
            },
            finishReason: data.choices?.[0]?.finish_reason || undefined,
          }],
          text: delta.content,
          data: '',
          functionCalls: [],
          executableCode: [],
          codeExecutionResult: [],
        } as unknown as GenerateContentResponse;
      }
      return null;
    } else {
      const choice = data.choices?.[0];
      const message = choice?.message;
      const content = message?.content || '';
      
      // Handle tool calls in non-streaming mode
      const parts: any[] = [];
      const functionCalls: any[] = [];
      
      if (message?.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const functionCall = {
            name: toolCall.function?.name || '',
            args: JSON.parse(toolCall.function?.arguments || '{}')
          };
          
          parts.push({ functionCall });
          functionCalls.push(functionCall);
        }
      }
      
      if (content) {
        parts.push({ text: content });
      }
      
      // If no parts, add empty text part
      if (parts.length === 0) {
        parts.push({ text: content });
      }
      
      return {
        candidates: [{
          content: {
            parts,
            role: 'model',
          },
          finishReason: choice?.finish_reason || 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: data.usage?.prompt_tokens || 0,
          candidatesTokenCount: data.usage?.completion_tokens || 0,
          totalTokenCount: data.usage?.total_tokens || 0,
        },
        text: content,
        data: '',
        functionCalls,
        executableCode: [],
        codeExecutionResult: [],
      } as unknown as GenerateContentResponse;
    }
  }
}