/**
 * Read Output Tool
 * Reads output channel content from VS Code's log files
 */

import * as vscode from 'vscode';
import { IReadOutputParams } from '../types';
import { getLogsPath, findOutputChannelLog, listAllOutputChannels } from '../utils';
import * as fs from 'fs';

export class ReadOutputTool implements vscode.LanguageModelTool<IReadOutputParams> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IReadOutputParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Reading output channel "${options.input.channelName}"...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IReadOutputParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { channelName, lines = 100 } = options.input;
    
    try {
      const logsPath = getLogsPath();
      
      if (!fs.existsSync(logsPath)) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify({
            success: false,
            error: 'Logs directory not found',
            logsPath,
          }, null, 2))
        ]);
      }
      
      // Special case: list all channels from ALL sessions
      if (channelName === '*' || channelName.toLowerCase() === 'list') {
        const channels = listAllOutputChannels(logsPath);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify({
            success: true,
            action: 'list',
            logsPath,
            channels,
          }, null, 2))
        ]);
      }
      
      // Search all sessions for the channel
      const result = findOutputChannelLog(logsPath, channelName);
      
      if (!result) {
        const available = listAllOutputChannels(logsPath);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify({
            success: false,
            error: `Output channel "${channelName}" not found`,
            availableChannels: available,
            hint: 'Use channelName="*" to list all channels',
          }, null, 2))
        ]);
      }
      
      // Return last N lines
      const allLines = result.content.split('\n');
      const recentLines = allLines.slice(-lines);
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({
          success: true,
          channelName,
          logPath: result.path,
          totalLines: allLines.length,
          returnedLines: recentLines.length,
          content: recentLines.join('\n'),
        }, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to read output channel: ${error}`);
    }
  }
}
