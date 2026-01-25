/**
 * MCP Output Tool
 * Reads MCP server output channels for debugging
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IMcpOutputParams } from '../types';
import { getAppDataPath } from '../utils';

export class McpOutputTool implements vscode.LanguageModelTool<IMcpOutputParams> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IMcpOutputParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { action, serverName } = options.input;
    return {
      invocationMessage: `MCP output ${action}${serverName ? ` for ${serverName}` : ''}...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IMcpOutputParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { action, serverName, lines = 50 } = options.input;
    
    try {
      switch (action) {
        case 'list': {
          // List all configured MCP servers that might have output
          const mcpConfig = await this.readMcpConfig();
          const servers = Object.keys(mcpConfig.servers || {});
          
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              action: 'list',
              servers,
              note: 'Use action="show" with serverName to open the output channel, or action="read" to get log content.',
              limitation: 'VS Code does not expose output channel content to extensions. Use "show" to open the panel visually.',
            }, null, 2))
          ]);
        }
        
        case 'show': {
          if (!serverName) {
            throw new Error('serverName is required for show action');
          }
          
          // Execute the show output command
          await vscode.commands.executeCommand('workbench.mcp.showOutput', serverName);
          
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              action: 'show',
              serverName,
              success: true,
              message: `Opened output channel for "${serverName}"`,
              note: 'Output channel is now visible in the Output panel.',
            }, null, 2))
          ]);
        }
        
        case 'read': {
          if (!serverName) {
            throw new Error('serverName is required for read action');
          }
          
          // Unfortunately, VS Code does not expose output channel content to extensions
          // We can try to read from the MCP server's log file if it exists
          const logContent = await this.tryReadMcpLog(serverName, lines);
          
          if (logContent) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify({
                action: 'read',
                serverName,
                success: true,
                lines: logContent.lines,
                source: logContent.source,
                content: logContent.content,
              }, null, 2))
            ]);
          }
          
          // Fallback: suggest using show action
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              action: 'read',
              serverName,
              success: false,
              error: 'Cannot read output channel content directly',
              suggestion: 'Use action="show" to open the output panel visually, or check for log files in the server directory.',
              limitation: 'VS Code does not expose OutputChannel content to extensions. This is a known limitation.',
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
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return { servers: {} };
    }
    
    for (const folder of workspaceFolders) {
      const mcpJsonPath = path.join(folder.uri.fsPath, '.vscode', 'mcp.json');
      if (fs.existsSync(mcpJsonPath)) {
        try {
          const content = fs.readFileSync(mcpJsonPath, 'utf-8');
          const cleaned = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          const parsed = JSON.parse(cleaned);
          return { servers: parsed.servers || {} };
        } catch {
          continue;
        }
      }
    }
    
    return { servers: {} };
  }
  
  private async tryReadMcpLog(serverName: string, maxLines: number): Promise<{ lines: number; source: string; content: string } | null> {
    // Try to find log files in common locations
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;
    
    const mcpConfig = await this.readMcpConfig();
    const serverConfig = mcpConfig.servers[serverName];
    if (!serverConfig) return null;
    
    // If server has args with a path, check for log files there
    const args = serverConfig.args || [];
    for (const arg of args) {
      if (typeof arg === 'string' && arg.includes('/')) {
        // This might be a path, check parent directory for logs
        const resolvedArg = arg.replace('${workspaceFolder}', workspaceFolders[0].uri.fsPath);
        const serverDir = path.dirname(resolvedArg);
        
        // Common log file patterns
        const logPatterns = ['*.log', 'mcp.log', 'server.log', 'output.log', 'debug.log'];
        
        for (const pattern of logPatterns) {
          const logPath = path.join(serverDir, pattern.replace('*', serverName));
          if (fs.existsSync(logPath)) {
            try {
              const content = fs.readFileSync(logPath, 'utf-8');
              const allLines = content.split('\n');
              const recentLines = allLines.slice(-maxLines);
              return {
                lines: recentLines.length,
                source: logPath,
                content: recentLines.join('\n'),
              };
            } catch {
              continue;
            }
          }
        }
      }
    }
    
    return null;
  }
}
