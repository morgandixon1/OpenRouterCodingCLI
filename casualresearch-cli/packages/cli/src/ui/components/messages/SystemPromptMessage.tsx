/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { HistoryItemSystemPrompt } from '../../types.js';

export interface SystemPromptMessageProps {
  item: HistoryItemSystemPrompt;
}

const SystemPromptMessage: React.FC<SystemPromptMessageProps> = ({ item }) => {
  const truncateText = (text: string, maxLength: number = 500) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '... [truncated]';
  };

  const displayText = truncateText(item.text);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color="magenta" bold>
          🔧 SYSTEM PROMPT
        </Text>
      </Box>
      <Box paddingLeft={2} paddingTop={1}>
        <Text color="gray" dimColor>
          {displayText}
        </Text>
      </Box>
    </Box>
  );
};

export default SystemPromptMessage;