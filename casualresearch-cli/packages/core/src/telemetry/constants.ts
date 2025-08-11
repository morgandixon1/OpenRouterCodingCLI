/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'casualresearch-cli';

export const EVENT_USER_PROMPT = 'casualresearch_cli.user_prompt';
export const EVENT_TOOL_CALL = 'casualresearch_cli.tool_call';
export const EVENT_API_REQUEST = 'casualresearch_cli.api_request';
export const EVENT_API_ERROR = 'casualresearch_cli.api_error';
export const EVENT_API_RESPONSE = 'casualresearch_cli.api_response';
export const EVENT_CLI_CONFIG = 'casualresearch_cli.config';
export const EVENT_FLASH_FALLBACK = 'casualresearch_cli.flash_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'casualresearch_cli.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'casualresearch_cli.slash_command';
export const EVENT_IDE_CONNECTION = 'casualresearch_cli.ide_connection';

export const METRIC_TOOL_CALL_COUNT = 'casualresearch_cli.tool.call.count';
export const METRIC_TOOL_CALL_LATENCY = 'casualresearch_cli.tool.call.latency';
export const METRIC_API_REQUEST_COUNT = 'casualresearch_cli.api.request.count';
export const METRIC_API_REQUEST_LATENCY = 'casualresearch_cli.api.request.latency';
export const METRIC_TOKEN_USAGE = 'casualresearch_cli.token.usage';
export const METRIC_SESSION_COUNT = 'casualresearch_cli.session.count';
export const METRIC_FILE_OPERATION_COUNT = 'casualresearch_cli.file.operation.count';
