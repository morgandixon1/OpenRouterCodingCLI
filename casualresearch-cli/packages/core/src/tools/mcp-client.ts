/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  Prompt,
  ListPromptsResultSchema,
  GetPromptResult,
  GetPromptResultSchema,
  ListRootsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parse } from 'shell-quote';
import { AuthProviderType, MCPServerConfig } from '../config/config.js';
import { GoogleCredentialProvider } from '../mcp/google-auth-provider.js';
import { DiscoveredMCPTool } from './mcp-tool.js';

import { FunctionDeclaration, mcpToTool } from '@google/genai';
import { ToolRegistry } from './tool-registry.js';
import { PromptRegistry } from '../prompts/prompt-registry.js';
import { MCPOAuthProvider } from '../mcp/oauth-provider.js';
import { OAuthUtils } from '../mcp/oauth-utils.js';
import { MCPOAuthTokenStorage } from '../mcp/oauth-token-storage.js';
import { getErrorMessage } from '../utils/errors.js';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorkspaceContext } from '../utils/workspaceContext.js';

export const MCP_DEFAULT_TIMEOUT_MSEC = 10 * 60 * 1000; // default to 10 minutes

export type DiscoveredMCPPrompt = Prompt & {
  serverName: string;
  invoke: (params: Record<string, unknown>) => Promise<GetPromptResult>;
};

/**
 * Enum representing the connection status of an MCP server
 */
export enum MCPServerStatus {
  /** Server is disconnected or experiencing errors */
  DISCONNECTED = 'disconnected',
  /** Server is in the process of connecting */
  CONNECTING = 'connecting',
  /** Server is connected and ready to use */
  CONNECTED = 'connected',
}

/**
 * Enum representing the overall MCP discovery state
 */
export enum MCPDiscoveryState {
  /** Discovery has not started yet */
  NOT_STARTED = 'not_started',
  /** Discovery is currently in progress */
  IN_PROGRESS = 'in_progress',
  /** Discovery has completed (with or without errors) */
  COMPLETED = 'completed',
}

/**
 * Map to track the status of each MCP server within the core package
 */
const serverStatuses: Map<string, MCPServerStatus> = new Map();

/**
 * Track the overall MCP discovery state
 */
let mcpDiscoveryState: MCPDiscoveryState = MCPDiscoveryState.NOT_STARTED;

/**
 * Map to track which MCP servers have been discovered to require OAuth
 */
export const mcpServerRequiresOAuth: Map<string, boolean> = new Map();

/**
 * Event listeners for MCP server status changes
 */
type StatusChangeListener = (
  serverName: string,
  status: MCPServerStatus,
) => void;
const statusChangeListeners: StatusChangeListener[] = [];

/**
 * Add a listener for MCP server status changes
 */
export function addMCPStatusChangeListener(
  listener: StatusChangeListener,
): void {
  statusChangeListeners.push(listener);
}

/**
 * Remove a listener for MCP server status changes
 */
export function removeMCPStatusChangeListener(
  listener: StatusChangeListener,
): void {
  const index = statusChangeListeners.indexOf(listener);
  if (index !== -1) {
    statusChangeListeners.splice(index, 1);
  }
}

/**
 * Update the status of an MCP server
 */
function updateMCPServerStatus(
  serverName: string,
  status: MCPServerStatus,
): void {
  serverStatuses.set(serverName, status);
  // Notify all listeners
  for (const listener of statusChangeListeners) {
    listener(serverName, status);
  }
}

/**
 * Get the current status of an MCP server
 */
export function getMCPServerStatus(serverName: string): MCPServerStatus {
  return serverStatuses.get(serverName) || MCPServerStatus.DISCONNECTED;
}

/**
 * Get all MCP server statuses
 */
export function getAllMCPServerStatuses(): Map<string, MCPServerStatus> {
  return new Map(serverStatuses);
}

/**
 * Get the current MCP discovery state
 */
export function getMCPDiscoveryState(): MCPDiscoveryState {
  return mcpDiscoveryState;
}

/**
 * Extract WWW-Authenticate header from error message string.
 * This is a more robust approach than regex matching.
 *
 * @param errorString The error message string
 * @returns The www-authenticate header value if found, null otherwise
 */
function extractWWWAuthenticateHeader(errorString: string): string | null {
  // Try multiple patterns to extract the header
  const patterns = [
    /www-authenticate:\s*([^\n\r]+)/i,
    /WWW-Authenticate:\s*([^\n\r]+)/i,
    /"www-authenticate":\s*"([^"]+)"/i,
    /'www-authenticate':\s*'([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = errorString.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Handle automatic OAuth discovery and authentication for a server.
 *
 * @param mcpServerName The name of the MCP server
 * @param mcpServerConfig The MCP server configuration
 * @param wwwAuthenticate The www-authenticate header value
 * @returns True if OAuth was successfully configured and authenticated, false otherwise
 */
async function handleAutomaticOAuth(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  wwwAuthenticate: string,
): Promise<boolean> {
  try {
    console.log(`🔐 '${mcpServerName}' requires OAuth authentication`);

    // Always try to parse the resource metadata URI from the www-authenticate header
    let oauthConfig;
    const resourceMetadataUri =
      OAuthUtils.parseWWWAuthenticateHeader(wwwAuthenticate);
    if (resourceMetadataUri) {
      oauthConfig = await OAuthUtils.discoverOAuthConfig(resourceMetadataUri);
    } else if (mcpServerConfig.url) {
      // Fallback: try to discover OAuth config from the base URL for SSE
      const sseUrl = new URL(mcpServerConfig.url);
      const baseUrl = `${sseUrl.protocol}//${sseUrl.host}`;
      oauthConfig = await OAuthUtils.discoverOAuthConfig(baseUrl);
    } else if (mcpServerConfig.httpUrl) {
      // Fallback: try to discover OAuth config from the base URL for HTTP
      const httpUrl = new URL(mcpServerConfig.httpUrl);
      const baseUrl = `${httpUrl.protocol}//${httpUrl.host}`;
      oauthConfig = await OAuthUtils.discoverOAuthConfig(baseUrl);
    }

    if (!oauthConfig) {
      console.error(
        `❌ Could not configure OAuth for '${mcpServerName}' - please authenticate manually with /mcp auth ${mcpServerName}`,
      );
      return false;
    }

    // OAuth configuration discovered - proceed with authentication

    // Create OAuth configuration for authentication
    const oauthAuthConfig = {
      enabled: true,
      authorizationUrl: oauthConfig.authorizationUrl,
      tokenUrl: oauthConfig.tokenUrl,
      scopes: oauthConfig.scopes || [],
    };

    // Perform OAuth authentication
    console.log(
      `Starting OAuth authentication for server '${mcpServerName}'...`,
    );
    await MCPOAuthProvider.authenticate(mcpServerName, oauthAuthConfig);

    console.log(
      `OAuth authentication successful for server '${mcpServerName}'`,
    );
    return true;
  } catch (error) {
    console.error(
      `Failed to handle automatic OAuth for server '${mcpServerName}': ${getErrorMessage(error)}`,
    );
    return false;
  }
}

/**
 * Checks if a function declaration is enabled for the given server.
 */
export function isEnabled(
  funcDecl: any,
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
): boolean {
  // Basic enablement check - can be extended with more sophisticated logic
  return true;
}

/**
 * Connects to an MCP server and returns the client.
 */
export async function connectToMcpServer(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  debugMode?: boolean,
  workspaceContext?: WorkspaceContext,
): Promise<Client | undefined> {
  try {
    const transport = await createTransport(mcpServerName, mcpServerConfig);
    if (!transport) {
      return undefined;
    }

    const client = new Client({
      name: 'casualresearch-cli',
      version: '0.1.18',
    }, {
      capabilities: {
        roots: {
          listChanged: true,
        },
        sampling: {},
      },
    });

    await client.connect(transport);
    return client;
  } catch (error) {
    console.error(`Failed to connect to MCP server '${mcpServerName}':`, error);
    return undefined;
  }
}

/**
 * Creates an MCP transport based on the server configuration.
 * @param mcpServerName The name of the MCP server
 * @param mcpServerConfig The MCP server configuration
 * @param enableOAuth Whether to enable OAuth authentication
 * @returns The transport, or null if creation fails
 */
export async function createTransport(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  enableOAuth: boolean = false,
): Promise<Transport | null> {
  try {
    if (mcpServerConfig.command) {
      // Create stdio transport for command-based servers
      return new StdioClientTransport({
        command: mcpServerConfig.command,
        args: mcpServerConfig.args || [],
        env: mcpServerConfig.env,
        cwd: mcpServerConfig.cwd,
      });
    } else if (mcpServerConfig.httpUrl) {
      // Create HTTP transport
      const transportOptions: StreamableHTTPClientTransportOptions = {
        requestInit: {
          headers: mcpServerConfig.headers,
        },
      };
      return new StreamableHTTPClientTransport(
        new URL(mcpServerConfig.httpUrl),
        transportOptions,
      );
    } else if (mcpServerConfig.url) {
      // Create SSE transport
      const transportOptions: SSEClientTransportOptions = {
        requestInit: {
          headers: mcpServerConfig.headers,
        },
      };
      return new SSEClientTransport(new URL(mcpServerConfig.url), transportOptions);
    }
    
    console.error(`No valid transport configuration found for server '${mcpServerName}'`);
    return null;
  } catch (error) {
    console.error(
      `Failed to create transport for server '${mcpServerName}': ${getErrorMessage(error)}`,
    );
    return null;
  }
}

/**
 * Create a transport with OAuth token for the given server configuration.
 *
 * @param mcpServerName The name of the MCP server
 * @param mcpServerConfig The MCP server configuration
 * @param accessToken The OAuth access token
 * @returns The transport with OAuth token, or null if creation fails
 */
async function createTransportWithOAuth(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  accessToken: string,
): Promise<StreamableHTTPClientTransport | SSEClientTransport | null> {
  try {
    if (mcpServerConfig.httpUrl) {
      // Create HTTP transport with OAuth token
      const oauthTransportOptions: StreamableHTTPClientTransportOptions = {
        requestInit: {
          headers: {
            ...mcpServerConfig.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      };

      return new StreamableHTTPClientTransport(
        new URL(mcpServerConfig.httpUrl),
        oauthTransportOptions,
      );
    } else if (mcpServerConfig.url) {
      // Create SSE transport with OAuth token in Authorization header
      return new SSEClientTransport(new URL(mcpServerConfig.url), {
        requestInit: {
          headers: {
            ...mcpServerConfig.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to create OAuth transport for server '${mcpServerName}': ${getErrorMessage(error)}`,
    );
    return null;
  }
}

/**
 * Discovers tools from all configured MCP servers and registers them with the tool registry.
 * It orchestrates the connection and discovery process for each server defined in the
 * configuration, as well as any server specified via a command-line argument.
 *
 * @param mcpServers A record of named MCP server configurations.
 * @param mcpServerCommand An optional command string for a dynamically specified MCP server.
 * @param toolRegistry The central registry where discovered tools will be registered.
 * @returns A promise that resolves when the discovery process has been attempted for all servers.
 */
export async function discoverMcpTools(
  mcpServers: Record<string, MCPServerConfig>,
  mcpServerCommand: string | undefined,
  toolRegistry: ToolRegistry,
  promptRegistry: PromptRegistry,
  debugMode: boolean,
  workspaceContext: WorkspaceContext,
): Promise<void> {
  mcpDiscoveryState = MCPDiscoveryState.IN_PROGRESS;
  try {
    mcpServers = populateMcpServerCommand(mcpServers, mcpServerCommand);

    const discoveryPromises = Object.entries(mcpServers).map(
      ([mcpServerName, mcpServerConfig]) =>
        connectAndDiscover(
          mcpServerName,
          mcpServerConfig,
          toolRegistry,
          promptRegistry,
          debugMode,
          workspaceContext,
        ),
    );
    await Promise.all(discoveryPromises);
  } finally {
    mcpDiscoveryState = MCPDiscoveryState.COMPLETED;
  }
}

/** Visible for Testing */
export function populateMcpServerCommand(
  mcpServers: Record<string, MCPServerConfig>,
  mcpServerCommand: string | undefined,
): Record<string, MCPServerConfig> {
  if (mcpServerCommand) {
    const cmd = mcpServerCommand;
    const args = parse(cmd, process.env) as string[];
    if (args.some((arg) => typeof arg !== 'string')) {
      throw new Error('failed to parse mcpServerCommand: ' + cmd);
    }
    // use generic server name 'mcp'
    mcpServers['mcp'] = {
      command: args[0],
      args: args.slice(1),
    };
  }
  return mcpServers;
}

/**
 * Connects to an MCP server and discovers available tools, registering them with the tool registry.
 * This function handles the complete lifecycle of connecting to a server, discovering tools,
 * and cleaning up resources if no tools are found.
 *
 * @param mcpServerName The name identifier for this MCP server
 * @param mcpServerConfig Configuration object containing connection details
 * @param toolRegistry The registry to register discovered tools with
 * @returns Promise that resolves when discovery is complete
 */
export async function connectAndDiscover(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  toolRegistry: ToolRegistry,
  promptRegistry: PromptRegistry,
  debugMode: boolean,
  workspaceContext: WorkspaceContext,
): Promise<void> {
  updateMCPServerStatus(mcpServerName, MCPServerStatus.CONNECTING);

  let mcpClient: Client | undefined;
  try {
    mcpClient = await connectToMcpServer(
      mcpServerName,
      mcpServerConfig,
      debugMode,
      workspaceContext,
    );

    if (!mcpClient) {
      console.error(`Failed to connect to MCP server '${mcpServerName}'`);
      updateMCPServerStatus(mcpServerName, MCPServerStatus.DISCONNECTED);
      return;
    }

    mcpClient.onerror = (error) => {
      console.error(`MCP ERROR (${mcpServerName}):`, error.toString());
      updateMCPServerStatus(mcpServerName, MCPServerStatus.DISCONNECTED);
    };

    // Attempt to discover both prompts and tools
    const prompts = await discoverPrompts(
      mcpServerName,
      mcpClient,
      promptRegistry,
    );
    const tools = await discoverTools(
      mcpServerName,
      mcpServerConfig,
      mcpClient,
    );

    // If we have neither prompts nor tools, it's a failed discovery
    if (prompts.length === 0 && tools.length === 0) {
      throw new Error('No prompts or tools found on the server.');
    }

    // If we found anything, the server is connected
    updateMCPServerStatus(mcpServerName, MCPServerStatus.CONNECTED);

    // Register any discovered tools
    for (const tool of tools) {
      toolRegistry.registerTool(tool);
    }
  } catch (error) {
    if (mcpClient) {
      mcpClient.close();
    }
    console.error(
      `Error connecting to MCP server '${mcpServerName}': ${getErrorMessage(
        error,
      )}`,
    );
    updateMCPServerStatus(mcpServerName, MCPServerStatus.DISCONNECTED);
  }
}

/**
 * Recursively validates that a JSON schema and all its nested properties and
 * items have a `type` defined.
 *
 * @param schema The JSON schema to validate.
 * @returns `true` if the schema is valid, `false` otherwise.
 *
 * @visiblefortesting
 */
export function hasValidTypes(schema: unknown): boolean {
  if (typeof schema !== 'object' || schema === null) {
    // Not a schema object we can validate, or not a schema at all.
    // Treat as valid as it has no properties to be invalid.
    return true;
  }

  const s = schema as Record<string, unknown>;

  if (!s.type) {
    // These keywords contain an array of schemas that should be validated.
    //
    // If no top level type was given, then they must each have a type.
    let hasSubSchema = false;
    const schemaArrayKeywords = ['anyOf', 'allOf', 'oneOf'];
    for (const keyword of schemaArrayKeywords) {
      const subSchemas = s[keyword];
      if (Array.isArray(subSchemas)) {
        hasSubSchema = true;
        for (const subSchema of subSchemas) {
          if (!hasValidTypes(subSchema)) {
            return false;
          }
        }
      }
    }

    // If the node itself is missing a type and had no subschemas, then it isn't valid.
    if (!hasSubSchema) return false;
  }

  if (s.type === 'object' && s.properties) {
    if (typeof s.properties === 'object' && s.properties !== null) {
      for (const prop of Object.values(s.properties)) {
        if (!hasValidTypes(prop)) {
          return false;
        }
      }
    }
  }

  if (s.type === 'array' && s.items) {
    if (!hasValidTypes(s.items)) {
      return false;
    }
  }

  return true;
}

/**
 * Discovers and sanitizes tools from a connected MCP client.
 * It retrieves function declarations from the client, filters out disabled tools,
 * generates valid names for them, and wraps them in `DiscoveredMCPTool` instances.
 *
 * @param mcpServerName The name of the MCP server.
 * @param mcpServerConfig The configuration for the MCP server.
 * @param mcpClient The active MCP client instance.
 * @returns A promise that resolves to an array of discovered and enabled tools.
 * @throws An error if no enabled tools are found or if the server provides invalid function declarations.
 */
export async function discoverTools(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  mcpClient: Client,
): Promise<DiscoveredMCPTool[]> {
  try {
    const mcpCallableTool = mcpToTool(mcpClient);
    const tool = await mcpCallableTool.tool();

    if (!Array.isArray(tool.functionDeclarations)) {
      // This is a valid case for a prompt-only server
      return [];
    }

    const discoveredTools: DiscoveredMCPTool[] = [];
    for (const funcDecl of tool.functionDeclarations) {
      try {
        if (!isEnabled(funcDecl, mcpServerName, mcpServerConfig)) {
          continue;
        }

        if (!hasValidTypes(funcDecl.parametersJsonSchema)) {
          console.warn(
            `Skipping tool '${funcDecl.name}' from MCP server '${mcpServerName}' ` +
              `because it has missing types in its parameter schema. Please file an ` +
              `issue with the owner of the MCP server.`,
          );
          continue;
        }

        discoveredTools.push(
          new DiscoveredMCPTool(
            mcpCallableTool,
            mcpServerName,
            funcDecl.name!,
            funcDecl.description ?? '',
            funcDecl.parametersJsonSchema ?? { type: 'object', properties: {} },
            mcpServerConfig.timeout ?? MCP_DEFAULT_TIMEOUT_MSEC,
            mcpServerConfig.trust,
          ),
        );
      } catch (error) {
        console.error(
          `Error discovering tool: '${
            funcDecl.name
          }' from MCP server '${mcpServerName}': ${(error as Error).message}`,
        );
      }
    }
    return discoveredTools;
  } catch (error) {
    if (
      error instanceof Error &&
      !error.message?.includes('Method not found')
    ) {
      console.error(
        `Error discovering tools from ${mcpServerName}: ${getErrorMessage(
          error,
        )}`,
      );
    }
    return [];
  }
}

/**
 * Discovers and logs prompts from a connected MCP client.
 * It retrieves prompt declarations from the client and logs their names.
 *
 * @param mcpServerName The name of the MCP server.
 * @param mcpClient The active MCP client instance.
 */
export async function discoverPrompts(
  mcpServerName: string,
  mcpClient: Client,
  promptRegistry: PromptRegistry,
): Promise<Prompt[]> {
  try {
    // Only request prompts if the server supports them.
    if (mcpClient.getServerCapabilities()?.prompts == null) return [];

    const response = await mcpClient.request(
      { method: 'prompts/list', params: {} },
      ListPromptsResultSchema,
    );

    for (const prompt of response.prompts) {
      // TODO(morgan): This is a hack to inject a system prompt.
      // The real solution is to have the MCP server provide the system prompt.
      const systemPrompt = `
You are a helpful assistant that can write and run code.

**You have access to the following tools:**

*   \`edit_file\`: Replaces text within a file.
*   \`read_file\`: Reads the content of a file.
*   \`run_shell_command\`: Executes a shell command.

**When you need to modify a file, you MUST use the \`edit_file\` tool.**

Use these tools to complete the user's requests effectively.
`;

      const discoveredPrompt: DiscoveredMCPPrompt = {
        name: prompt.name,
        description: prompt.description,
        serverName: mcpServerName,
        arguments: prompt.arguments || [],
        systemPrompt,
        originalPromptData: prompt,
        invoke: async (params: Record<string, unknown>) => {
          // Implementation would call the MCP server's prompts/get endpoint
          // This is a placeholder implementation
          return {
            messages: [
              {
                role: 'user' as const,
                content: {
                  type: 'text' as const,
                  text: systemPrompt,
                },
              },
            ],
            description: prompt.description,
          };
        },
      };

      promptRegistry.registerPrompt(discoveredPrompt);
    }

    return promptRegistry.getAllPrompts();
  } catch (error) {
    console.error(`Error discovering prompts from ${mcpServerName}:`, error);
    return [];
  }
}