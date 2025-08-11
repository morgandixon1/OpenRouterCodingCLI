/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadedSettings, saveSettings } from '../../config/settings.js';
import { Config } from '@google/casualresearch-cli-core';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface ConfigDialogProps {
  onClose: () => void;
  settings: LoadedSettings;
  config: Config;
}

type ConfigStep = 'main' | 'edit-endpoint' | 'edit-api-key';

const commonModels = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku', 
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-70b-instruct',
  'qwen/qwen-2.5-coder-32b-instruct',
];

export function ConfigDialog({
  onClose,
  settings,
  config,
}: ConfigDialogProps): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<ConfigStep>('main');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number>(0);

  // Get current settings
  const currentModel = config.getModel() || 'Not set';
  const currentApiKey = process.env.OPENROUTER_API_KEY || 'Not set';

  const cleanInput = (str: string) => {
    if (!str) return '';
    
    return str
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape sequences
      .replace(/\[200~/g, '') // Remove bracketed paste start
      .replace(/\[201~/g, '') // Remove bracketed paste end  
      .replace(/\[O/g, '') // Remove other escape sequences
      .replace(/\[I/g, '') // Remove other escape sequences
      .replace(/[\x00-\x08\x0e-\x1f]/g, '') // Remove most control characters
      .trim();
  };

  const handleMainMenuSubmit = useCallback(() => {
    if (selectedOption === 0) {
      // Edit endpoint
      const currentModelIndex = commonModels.findIndex(model => model === currentModel);
      setSelectedModelIndex(currentModelIndex >= 0 ? currentModelIndex : 0);
      setCurrentStep('edit-endpoint');
    } else if (selectedOption === 1) {
      // Edit API key
      setCurrentInput(currentApiKey === 'Not set' ? '' : currentApiKey);
      setCurrentStep('edit-api-key');
    } else if (selectedOption === 2) {
      // Exit
      onClose();
    }
  }, [selectedOption, currentModel, currentApiKey, onClose]);

  const handleEndpointSubmit = useCallback(() => {
    let newModel: string;
    if (currentInput.trim() === '') {
      // Use selected model from list
      newModel = commonModels[selectedModelIndex];
    } else {
      // Use custom model input
      newModel = currentInput.trim();
    }
    
    console.log('Saving model to config:', newModel);
    
    // Save to both config object and settings file
    config.setModel(newModel);
    
    // Also save to settings file for persistence
    settings.user.settings.model = newModel;
    saveSettings(settings.user);
    
    setCurrentStep('main');
    setCurrentInput('');
  }, [currentInput, selectedModelIndex, config, settings]);

  const handleApiKeySubmit = useCallback(() => {
    const newApiKey = currentInput.trim();
    if (newApiKey === '') {
      return; // Don't save empty API key
    }
    
    // Save the API key to .env file
    const envPath = path.join(homedir(), '.casualresearch', '.env');
    const envDir = path.dirname(envPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }
    
    // Read existing .env content if it exists
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Add or update the OPENROUTER_API_KEY
    const lines = envContent.split('\n');
    const keyLine = lines.findIndex(line => line.startsWith('OPENROUTER_API_KEY='));
    const newKeyLine = `OPENROUTER_API_KEY=${newApiKey}`;
    
    if (keyLine >= 0) {
      lines[keyLine] = newKeyLine;
    } else {
      lines.push(newKeyLine);
    }
    
    // Write back to file
    fs.writeFileSync(envPath, lines.join('\n'));
    
    // Set in current process
    process.env.OPENROUTER_API_KEY = newApiKey;
    
    setCurrentStep('main');
    setCurrentInput('');
  }, [currentInput]);

  useInput((input, key) => {
    if (currentStep === 'main') {
      if (key.return) {
        handleMainMenuSubmit();
        return;
      }
      
      if (key.upArrow) {
        setSelectedOption(Math.max(0, selectedOption - 1));
        return;
      }
      
      if (key.downArrow) {
        setSelectedOption(Math.min(2, selectedOption + 1));
        return;
      }
      
      // Handle number keys
      if (input === '1') {
        setSelectedOption(0);
        return;
      }
      if (input === '2') {
        setSelectedOption(1);
        return;
      }
      if (input === '3') {
        setSelectedOption(2);
        return;
      }
    }

    if (currentStep === 'edit-endpoint') {
      if (key.return) {
        handleEndpointSubmit();
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
        // Handle backspace
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

    if (currentStep === 'edit-api-key') {
      if (key.return) {
        handleApiKeySubmit();
        return;
      }
      
      if (input === '\x7f' || input === '\x08') {
        // Handle backspace
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

  if (currentStep === 'main') {
    return (
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color="white">OpenRouter Configuration</Text>
        <Box marginTop={1}>
          <Text color="white">Current Settings:</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="white">  Model Endpoint: </Text>
          <Text color={currentModel === 'Not set' ? 'red' : 'green'}>
            {currentModel}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="white">  API Key: </Text>
          <Text color={currentApiKey === 'Not set' ? 'red' : 'green'}>
            {currentApiKey === 'Not set' ? 'Not set' : '***...***'}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="white">Options:</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={selectedOption === 0 ? 'cyan' : 'white'}>
            {selectedOption === 0 ? '● ' : '  '}1. Edit Model Endpoint
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text color={selectedOption === 1 ? 'cyan' : 'white'}>
            {selectedOption === 1 ? '● ' : '  '}2. Edit API Key
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text color={selectedOption === 2 ? 'cyan' : 'white'}>
            {selectedOption === 2 ? '● ' : '  '}3. Exit Config
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">(Use ↑↓ arrows, 1-3 keys, or Enter to select)</Text>
        </Box>
      </Box>
    );
  }

  if (currentStep === 'edit-endpoint') {
    return (
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color="white">Edit Model Endpoint</Text>
        <Box marginTop={1}>
          <Text color="white">Current: </Text>
          <Text color="cyan">{currentModel}</Text>
        </Box>
        
        {currentInput === '' && (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Popular models (use ↑↓ arrows):</Text>
            {commonModels.map((model, index) => (
              <Box key={model} marginTop={index === 0 ? 1 : 0}>
                <Text color={index === selectedModelIndex ? 'cyan' : 'white'}>
                  {index === selectedModelIndex ? '● ' : '  '}
                  {model}
                </Text>
              </Box>
            ))}
            <Box marginTop={1}>
              <Text color="gray">Or type custom model endpoint:</Text>
            </Box>
          </Box>
        )}
        
        <Box marginTop={1}>
          <Text color="cyan">
            {'> '}
            {currentInput}
            <Text backgroundColor="gray">
              {' '}
            </Text>
          </Text>
        </Box>
        
        <Box marginTop={1}>
          <Text color="gray">(Press Enter to save)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color="white">Edit API Key</Text>
      <Box marginTop={1}>
        <Text color="white">Current: </Text>
        <Text color="cyan">
          {currentApiKey === 'Not set' ? 'Not set' : '***...***'}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="white">New API Key:</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="cyan">
          {'> '}
          {currentInput}
          <Text backgroundColor="gray">
            {' '}
          </Text>
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">
          Get your API key from: https://openrouter.ai/keys
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">(Press Enter to save)</Text>
      </Box>
    </Box>
  );
}