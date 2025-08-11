/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@google/casualresearch-cli-core';

interface OpenRouterSetupProps {
  onComplete: (apiKey: string, modelEndpoint: string, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

type SetupStep = 'api-key' | 'model-endpoint';

const commonModels = [
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-70b-instruct',
];

export function OpenRouterSetup({
  onComplete,
  settings,
  initialErrorMessage,
}: OpenRouterSetupProps): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<SetupStep>('api-key');
  const [apiKey, setApiKey] = useState<string>('');
  const [modelEndpoint, setModelEndpoint] = useState<string>('');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage || null);
  const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);

  const handleApiKeySubmit = useCallback(() => {
    if (currentInput.trim() === '') {
      setErrorMessage('API key cannot be empty');
      return;
    }
    
    setApiKey(currentInput.trim());
    setCurrentInput('');
    setErrorMessage(null);
    setCurrentStep('model-endpoint');
  }, [currentInput]);

  const handleModelSubmit = useCallback(() => {
    if (currentInput.trim() === '') {
      // Use selected model from list
      const selectedModel = commonModels[selectedModelIndex];
      onComplete(apiKey, selectedModel, SettingScope.User);
    } else {
      // Use custom model input
      if (currentInput.trim() === '') {
        setErrorMessage('Model endpoint cannot be empty');
        return;
      }
      onComplete(apiKey, currentInput.trim(), SettingScope.User);
    }
  }, [currentInput, selectedModelIndex, apiKey, onComplete]);

  useInput((input, key) => {
    // Function to clean input by removing escape sequences and control characters
    const cleanInput = (str: string) => {
      if (!str) return '';
      
      return str
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape sequences
        .replace(/\[200~/g, '') // Remove bracketed paste start
        .replace(/\[201~/g, '') // Remove bracketed paste end  
        .replace(/\[O/g, '') // Remove other escape sequences
        .replace(/\[I/g, '') // Remove other escape sequences
        .replace(/[\x00-\x08\x0e-\x1f]/g, '') // Remove most control characters but keep tab (\x09) and newlines (\x0a, \x0d)
        .trim();
    };

    if (currentStep === 'api-key') {
      if (key.return) {
        handleApiKeySubmit();
        return;
      }
      
      if (input === '\x7f' || input === '\x08') {
        // Handle backspace (DEL or BS characters)
        setCurrentInput(prev => prev.slice(0, -1));
        return;
      }

      if (input && input.length > 0 && !key.ctrl && !key.meta) {
        const cleaned = cleanInput(input);
        if (cleaned.length > 0) {
          setCurrentInput(prev => prev + cleaned);
        }
        return;
      }
    }

    if (currentStep === 'model-endpoint') {
      if (key.return) {
        handleModelSubmit();
        return;
      }

      if (key.upArrow && currentInput === '') {
        setSelectedModelIndex(Math.max(0, selectedModelIndex - 1));
        return;
      }

      if (key.downArrow && currentInput === '') {
        setSelectedModelIndex(Math.min(commonModels.length - 1, selectedModelIndex + 1));
        return;
      }
      
      if (input === '\x7f' || input === '\x08') {
        // Handle backspace (DEL or BS characters)
        setCurrentInput(prev => prev.slice(0, -1));
        return;
      }

      if (input && input.length > 0 && !key.ctrl && !key.meta) {
        const cleaned = cleanInput(input);
        if (cleaned.length > 0) {
          setCurrentInput(prev => prev + cleaned);
        }
        return;
      }
    }
  });

  if (currentStep === 'api-key') {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>OpenRouter Setup - Step 1/2</Text>
        <Box marginTop={1}>
          <Text>Enter your OpenRouter API Key:</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.AccentBlue}>
            {'> '}
            {currentInput}
            <Text backgroundColor={Colors.Gray}>
              {' '}
            </Text>
          </Text>
        </Box>
        {errorMessage && (
          <Box marginTop={1}>
            <Text color={Colors.AccentRed}>{errorMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            Get your API key from: https://openrouter.ai/keys
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.Gray}>(Press Enter to continue)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>OpenRouter Setup - Step 2/2</Text>
      <Box marginTop={1}>
        <Text>Select a model endpoint:</Text>
      </Box>
      
      {currentInput === '' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={Colors.Gray}>Popular models (use ↑↓ arrows):</Text>
          {commonModels.map((model, index) => (
            <Box key={model} marginTop={index === 0 ? 1 : 0}>
              <Text color={index === selectedModelIndex ? Colors.AccentBlue : Colors.Gray}>
                {index === selectedModelIndex ? '● ' : '  '}
                {model}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text color={Colors.Gray}>Or type custom model endpoint:</Text>
          </Box>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'> '}
          {currentInput}
          <Text backgroundColor={Colors.Gray}>
            {' '}
          </Text>
        </Text>
      </Box>
      
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Press Enter to complete setup)</Text>
      </Box>
    </Box>
  );
}