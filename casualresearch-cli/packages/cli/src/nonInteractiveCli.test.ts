/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Config,
  executeToolCall,
  ToolRegistry,
  ToolErrorType,
  shutdownTelemetry,
  casualresearchEventType,
  ServercasualresearchStreamEvent,
} from '@google/casualresearch-cli-core';
import { Part } from '@google/genai';
import { runNonInteractive } from './nonInteractiveCli.js';
import { vi } from 'vitest';

// Mock core modules
vi.mock('@google/casualresearch-cli-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@google/casualresearch-cli-core')>();
  return {
    ...original,
    executeToolCall: vi.fn(),
    shutdownTelemetry: vi.fn(),
    isTelemetrySdkInitialized: vi.fn().mockReturnValue(true),
  };
});

describe('runNonInteractive', () => {
  let mockConfig: Config;
  let mockToolRegistry: ToolRegistry;
  let mockCoreExecuteToolCall: vi.Mock;
  let mockShutdownTelemetry: vi.Mock;
  let consoleErrorSpy: vi.SpyInstance;
  let processExitSpy: vi.SpyInstance;
  let processStdoutSpy: vi.SpyInstance;
  let mockcasualresearchClient: {
    sendMessageStream: vi.Mock;
  };

  beforeEach(() => {
    mockCoreExecuteToolCall = vi.mocked(executeToolCall);
    mockShutdownTelemetry = vi.mocked(shutdownTelemetry);

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as (code?: number) => never);
    processStdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    mockToolRegistry = {
      getTool: vi.fn(),
      getFunctionDeclarations: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockcasualresearchClient = {
      sendMessageStream: vi.fn(),
    };

    mockConfig = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getcasualresearchClient: vi.fn().mockReturnValue(mockcasualresearchClient),
      getToolRegistry: vi.fn().mockResolvedValue(mockToolRegistry),
      getMaxSessionTurns: vi.fn().mockReturnValue(10),
      getIdeMode: vi.fn().mockReturnValue(false),
      getFullContext: vi.fn().mockReturnValue(false),
      getContentGeneratorConfig: vi.fn().mockReturnValue({}),
      getDebugMode: vi.fn().mockReturnValue(false),
    } as unknown as Config;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function* createStreamFromEvents(
    events: ServercasualresearchStreamEvent[],
  ): AsyncGenerator<ServercasualresearchStreamEvent> {
    for (const event of events) {
      yield event;
    }
  }

  it('should process input and write text output', async () => {
    const events: ServercasualresearchStreamEvent[] = [
      { type: casualresearchEventType.Content, value: 'Hello' },
      { type: casualresearchEventType.Content, value: ' World' },
    ];
    mockcasualresearchClient.sendMessageStream.mockReturnValue(
      createStreamFromEvents(events),
    );

    await runNonInteractive(mockConfig, 'Test input', 'prompt-id-1');

    expect(mockcasualresearchClient.sendMessageStream).toHaveBeenCalledWith(
      [{ text: 'Test input' }],
      expect.any(AbortSignal),
      'prompt-id-1',
    );
    expect(processStdoutSpy).toHaveBeenCalledWith('Hello');
    expect(processStdoutSpy).toHaveBeenCalledWith(' World');
    expect(processStdoutSpy).toHaveBeenCalledWith('\n');
    expect(mockShutdownTelemetry).toHaveBeenCalled();
  });

  it('should handle a single tool call and respond', async () => {
    const toolCallEvent: ServercasualresearchStreamEvent = {
      type: casualresearchEventType.ToolCallRequest,
      value: {
        callId: 'tool-1',
        name: 'testTool',
        args: { arg1: 'value1' },
        isClientInitiated: false,
        prompt_id: 'prompt-id-2',
      },
    };
    const toolResponse: Part[] = [{ text: 'Tool response' }];
    mockCoreExecuteToolCall.mockResolvedValue({ responseParts: toolResponse });

    const firstCallEvents: ServercasualresearchStreamEvent[] = [toolCallEvent];
    const secondCallEvents: ServercasualresearchStreamEvent[] = [
      { type: casualresearchEventType.Content, value: 'Final answer' },
    ];

    mockcasualresearchClient.sendMessageStream
      .mockReturnValueOnce(createStreamFromEvents(firstCallEvents))
      .mockReturnValueOnce(createStreamFromEvents(secondCallEvents));

    await runNonInteractive(mockConfig, 'Use a tool', 'prompt-id-2');

    expect(mockcasualresearchClient.sendMessageStream).toHaveBeenCalledTimes(2);
    expect(mockCoreExecuteToolCall).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ name: 'testTool' }),
      mockToolRegistry,
      expect.any(AbortSignal),
    );
    expect(mockcasualresearchClient.sendMessageStream).toHaveBeenNthCalledWith(
      2,
      [{ text: 'Tool response' }],
      expect.any(AbortSignal),
      'prompt-id-2',
    );
    expect(processStdoutSpy).toHaveBeenCalledWith('Final answer');
    expect(processStdoutSpy).toHaveBeenCalledWith('\n');
  });

  it('should handle error during tool execution', async () => {
    const toolCallEvent: ServercasualresearchStreamEvent = {
      type: casualresearchEventType.ToolCallRequest,
      value: {
        callId: 'tool-1',
        name: 'errorTool',
        args: {},
        isClientInitiated: false,
        prompt_id: 'prompt-id-3',
      },
    };
    mockCoreExecuteToolCall.mockResolvedValue({
      error: new Error('Tool execution failed badly'),
      errorType: ToolErrorType.UNHANDLED_EXCEPTION,
    });
    mockcasualresearchClient.sendMessageStream.mockReturnValue(
      createStreamFromEvents([toolCallEvent]),
    );

    await runNonInteractive(mockConfig, 'Trigger tool error', 'prompt-id-3');

    expect(mockCoreExecuteToolCall).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error executing tool errorTool: Tool execution failed badly',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with error if sendMessageStream throws initially', async () => {
    const apiError = new Error('API connection failed');
    mockcasualresearchClient.sendMessageStream.mockImplementation(() => {
      throw apiError;
    });

    await runNonInteractive(mockConfig, 'Initial fail', 'prompt-id-4');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[API Error: API connection failed]',
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should not exit if a tool is not found, and should send error back to model', async () => {
    const toolCallEvent: ServercasualresearchStreamEvent = {
      type: casualresearchEventType.ToolCallRequest,
      value: {
        callId: 'tool-1',
        name: 'nonexistentTool',
        args: {},
        isClientInitiated: false,
        prompt_id: 'prompt-id-5',
      },
    };
    mockCoreExecuteToolCall.mockResolvedValue({
      error: new Error('Tool "nonexistentTool" not found in registry.'),
      resultDisplay: 'Tool "nonexistentTool" not found in registry.',
    });
    const finalResponse: ServercasualresearchStreamEvent[] = [
      {
        type: casualresearchEventType.Content,
        value: "Sorry, I can't find that tool.",
      },
    ];

    mockcasualresearchClient.sendMessageStream
      .mockReturnValueOnce(createStreamFromEvents([toolCallEvent]))
      .mockReturnValueOnce(createStreamFromEvents(finalResponse));

    await runNonInteractive(
      mockConfig,
      'Trigger tool not found',
      'prompt-id-5',
    );

    expect(mockCoreExecuteToolCall).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error executing tool nonexistentTool: Tool "nonexistentTool" not found in registry.',
    );
    expect(processExitSpy).not.toHaveBeenCalled();
    expect(mockcasualresearchClient.sendMessageStream).toHaveBeenCalledTimes(2);
    expect(processStdoutSpy).toHaveBeenCalledWith(
      "Sorry, I can't find that tool.",
    );
  });

  it('should exit when max session turns are exceeded', async () => {
    vi.mocked(mockConfig.getMaxSessionTurns).mockReturnValue(0);
    await runNonInteractive(mockConfig, 'Trigger loop', 'prompt-id-6');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '\n Reached max session turns for this session. Increase the number of turns by specifying maxSessionTurns in settings.json.',
    );
  });
});
