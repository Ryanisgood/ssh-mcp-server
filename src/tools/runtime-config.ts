import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SSHConnectionManager } from "../services/ssh-connection-manager.js";
import {
  loadSshConfigFile,
  redactSshConfig,
  removeSshConfigFile,
  SshConfigFileState,
  upsertSshConfigFile,
} from "../services/ssh-config-store.js";
import { Logger } from "../utils/logger.js";
import { ToolError, toToolError } from "../utils/tool-error.js";
import { SSHConfig } from "../models/types.js";
import { formatServerList } from "./list-servers.js";

export interface RuntimeConfigToolContext {
  configFilePath?: string;
}

const runtimeConfigSchema = {
  name: z.string().min(1).describe("SSH connection name"),
  host: z.string().min(1).describe("SSH host or IP"),
  port: z.union([z.number(), z.string()]).describe("SSH port"),
  username: z.string().min(1).describe("SSH username"),
  password: z.string().optional().describe("SSH password"),
  privateKey: z.string().optional().describe("Private key path"),
  passphrase: z.string().optional().describe("Private key passphrase"),
  agent: z.string().optional().describe("SSH agent identifier"),
  socksProxy: z.string().optional().describe("SOCKS proxy URL"),
  pty: z.boolean().optional().describe("Allocate pseudo-tty"),
  tryKeyboard: z.boolean().optional().describe("Enable keyboard-interactive authentication"),
  transportMode: z.enum(["exec", "shell"]).optional().describe("SSH transport mode"),
  shellReadyTimeoutMs: z.number().optional().describe("Shell readiness timeout in milliseconds"),
  shellCommandTimeoutMs: z.number().optional().describe("Shell command timeout in milliseconds"),
  commandTemplate: z.string().optional().describe("Command wrapper template"),
  commandWhitelist: z.array(z.string()).optional().describe("Allowed command regexes"),
  commandBlacklist: z.array(z.string()).optional().describe("Blocked command regexes"),
  allowedLocalPaths: z.array(z.string()).optional().describe("Allowed local paths"),
  allowedRemotePaths: z.array(z.string()).optional().describe("Allowed remote paths"),
  renewalPrice: z.string().optional().describe("Optional VPS renewal price, e.g. 35 CNY or 5.99 USD"),
  expiresAt: z.string().optional().describe("Optional VPS expiration date, preferably YYYY-MM-DD"),
  billingCycle: z.string().optional().describe("Optional VPS billing cycle, e.g. monthly, quarterly, yearly, one-time"),
};

function requireConfigFile(context?: RuntimeConfigToolContext): string {
  if (!context?.configFilePath) {
    throw new ToolError(
      "CONFIG_FILE_REQUIRED",
      "Runtime config tools require the MCP server to start with --config-file so changes can be persisted and reloaded.",
      false,
    );
  }
  return context.configFilePath;
}

function applyState(state: SshConfigFileState): void {
  SSHConnectionManager.getInstance().setConfig(state.configs);
}

function redactedConfig(config?: SSHConfig): Record<string, unknown> | undefined {
  if (!config) {
    return undefined;
  }
  return redactSshConfig(config);
}

function formatRuntimeConfigResult(
  message: string,
  state: SshConfigFileState,
  updatedName?: string,
): string {
  const updatedConfig = updatedName
    ? redactedConfig(state.configs[updatedName])
    : undefined;

  const sections = [
    message,
    `Config file: ${state.configFilePath}`,
    `Format: ${state.format}`,
  ];

  if (updatedConfig) {
    sections.push(
      "",
      "Updated server:",
      JSON.stringify(updatedConfig, null, 2),
    );
  }

  sections.push(
    "",
    formatServerList(SSHConnectionManager.getInstance().getAllServerInfos()),
  );

  return sections.join("\n");
}

function formatToolError(error: unknown) {
  const toolError = toToolError(error, "RUNTIME_CONFIG_ERROR");
  Logger.handleError(toolError, "Failed to update runtime SSH config");
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            code: toolError.code,
            message: toolError.message,
            retriable: toolError.retriable,
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

export function registerRuntimeConfigTools(
  server: McpServer,
  context?: RuntimeConfigToolContext,
): void {
  server.registerTool(
    "reload-config",
    {
      description: "Reload SSH server configurations from the configured --config-file without restarting the MCP server",
    },
    async () => {
      try {
        const state = loadSshConfigFile(requireConfigFile(context));
        applyState(state);
        return {
          content: [
            {
              type: "text" as const,
              text: formatRuntimeConfigResult("Runtime SSH config reloaded.", state),
            },
          ],
        };
      } catch (error: unknown) {
        return formatToolError(error);
      }
    },
  );

  server.registerTool(
    "upsert-server",
    {
      description: "Add or update one SSH server in the configured --config-file and reload runtime SSH configs",
      inputSchema: runtimeConfigSchema,
    },
    async (config) => {
      try {
        const state = upsertSshConfigFile(requireConfigFile(context), config);
        applyState(state);
        return {
          content: [
            {
              type: "text" as const,
              text: formatRuntimeConfigResult(
                "Runtime SSH config updated.",
                state,
                config.name,
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return formatToolError(error);
      }
    },
  );

  server.registerTool(
    "remove-server",
    {
      description: "Remove one SSH server from the configured --config-file and reload runtime SSH configs",
      inputSchema: {
        name: z.string().min(1).describe("SSH connection name to remove"),
      },
    },
    async ({ name }) => {
      try {
        const state = removeSshConfigFile(requireConfigFile(context), name);
        applyState(state);
        return {
          content: [
            {
              type: "text" as const,
              text: formatRuntimeConfigResult(
                `Runtime SSH config removed: ${name}`,
                state,
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return formatToolError(error);
      }
    },
  );
}
