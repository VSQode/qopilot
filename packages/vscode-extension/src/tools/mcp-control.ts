/**
 * MCP Control Tool
 * Uses VS Code's workbench.mcp.* commands to control MCP servers
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IMcpControlParams } from '../types';
import { getAppDataPath } from '../utils';

export class McpControlTool implements vscode.LanguageModelTool<IMcpControlParams> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IMcpControlParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { action, serverName } = options.input;
    return {
      invocationMessage: `MCP ${action}${serverName ? ` ${serverName}` : ''}...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IMcpControlParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { action, serverName } = options.input;
    
    try {
      // Read MCP configuration to find server names
      const mcpConfig = await this.readMcpConfig();
      
      switch (action) {
        case 'list': {
          // List all configured MCP servers
          const servers = Object.keys(mcpConfig.servers || {});
          const result = {
            action: 'list',
            serverCount: servers.length,
            servers: servers.map(name => ({
              name,
              config: mcpConfig.servers[name],
            })),
            note: 'Use start/stop/restart with a serverName to control individual servers.',
            commands: {
              startAll: 'workbench.mcp.startServer with "*"',
              start: 'workbench.mcp.startServer',
              stop: 'workbench.mcp.stopServer',
              restart: 'workbench.mcp.restartServer',
            }
          };
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2))
          ]);
        }
        
        case 'start-all': {
          // Start all servers using wildcard
          await vscode.commands.executeCommand('workbench.mcp.startServer', '*');
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              action: 'start-all',
              success: true,
              message: 'Triggered start for all MCP servers',
            }, null, 2))
          ]);
        }
        
        case 'start':
        case 'stop':
        case 'restart': {
          if (!serverName) {
            throw new Error(`serverName is required for ${action} action`);
          }
          
          // Find the server ID - for VS Code MCP, server ID format is typically the server name
          // We need to match against what's in the mcp.json
          const servers = Object.keys(mcpConfig.servers || {});
          if (!servers.includes(serverName)) {
            throw new Error(`Server "${serverName}" not found in mcp.json. Available: ${servers.join(', ')}`);
          }
          
          // Map action to command
          const commandMap: Record<string, string> = {
            'start': 'workbench.mcp.startServer',
            'stop': 'workbench.mcp.stopServer',
            'restart': 'workbench.mcp.restartServer',
          };
          
          const command = commandMap[action];
          
          // Execute the command
          // Note: The server ID might be different from the name in some cases
          // We try the name directly first
          await vscode.commands.executeCommand(command, serverName);
          
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              action,
              serverName,
              success: true,
              command,
              message: `Executed ${action} for server "${serverName}"`,
            }, null, 2))
          ]);
        }
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({
          action,
          serverName,
          success: false,
          error,
        }, null, 2))
      ]);
    }
  }
  
  private async readMcpConfig(): Promise<{ servers: Record<string, any> }> {
    // Try to read mcp.json from workspace .vscode folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return { servers: {} };
    }
    
    for (const folder of workspaceFolders) {
      const mcpJsonPath = path.join(folder.uri.fsPath, '.vscode', 'mcp.json');
      if (fs.existsSync(mcpJsonPath)) {
        try {
          const content = fs.readFileSync(mcpJsonPath, 'utf-8');
          // Handle JSONC (JSON with comments)
          const cleaned = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          const parsed = JSON.parse(cleaned);
          return { servers: parsed.servers || {} };
        } catch {
          continue;
        }
      }
    }
    
    // Also try user-level mcp.json
    const appDataPath = getAppDataPath();
    const userMcpPath = path.join(appDataPath, 'mcp.json');
    if (fs.existsSync(userMcpPath)) {
      try {
        const content = fs.readFileSync(userMcpPath, 'utf-8');
        const cleaned = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const parsed = JSON.parse(cleaned);
        return { servers: parsed.servers || {} };
      } catch {
        // Fall through
      }
    }
    
    return { servers: {} };
  }
}
