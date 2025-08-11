/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;

export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/casualresearch-api/docs/models
  switch (model) {
    case 'casualresearch-1.5-pro':
      return 2_097_152;
    case 'casualresearch-1.5-flash':
    case 'casualresearch-2.5-pro-preview-05-06':
    case 'casualresearch-2.5-pro-preview-06-05':
    case 'casualresearch-2.5-pro':
    case 'casualresearch-2.5-flash-preview-05-20':
    case 'casualresearch-2.5-flash':
    case 'casualresearch-2.5-flash-lite':
    case 'casualresearch-2.0-flash':
      return 1_048_576;
    case 'casualresearch-2.0-flash-preview-image-generation':
      return 32_000;
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
