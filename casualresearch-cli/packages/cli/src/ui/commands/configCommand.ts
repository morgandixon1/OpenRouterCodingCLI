/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, OpenDialogActionReturn, SlashCommand } from './types.js';

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'configure OpenRouter settings (API key and model)',
  kind: CommandKind.BUILT_IN,
  action: (_context, _args): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'config',  // Use a dedicated config dialog
  }),
};