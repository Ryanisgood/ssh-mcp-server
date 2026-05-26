import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExecuteCommandTool } from "./execute-command.js";
import { registerUploadTool } from "./upload.js";
import { registerDownloadTool } from "./download.js";
import { registerListServersTool } from "./list-servers.js";
import {
  registerRuntimeConfigTools,
  RuntimeConfigToolContext,
} from "./runtime-config.js";

/**
 * Register all tools
 * @param server MCP server instance
 */
export function registerAllTools(
  server: McpServer,
  context?: RuntimeConfigToolContext,
): void {
  registerExecuteCommandTool(server);
  registerUploadTool(server);
  registerDownloadTool(server);
  registerListServersTool(server);
  registerRuntimeConfigTools(server, context);
} 
