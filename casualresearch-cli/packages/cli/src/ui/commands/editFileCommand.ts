/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandKind,
  type SlashCommand,
} from './types.js';

export const editFileCommand: SlashCommand = {
  name: 'edit_file',
  description: 'Replaces text within a file.',
  kind: CommandKind.BUILT_IN,
  action: (context, args) => {
    // This command is handled by the built-in edit tool
    // The actual implementation is in the EditTool class
    context.ui.setDebugMessage('edit_file command - handled by EditTool');
  },
};