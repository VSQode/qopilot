/**
 * Execute Command Tool
 * Executes arbitrary VS Code workbench commands
 * 
 * v0.2.0: Added fireAndForget mode for UI commands that may freeze
 * Author: ALTAIR 0.0.Q
 */

import * as vscode from 'vscode';
import { IExecuteCommandParams, OutputChannel } from '../types';

// Commands that should fire-and-forget by default (UI commands that may block/freeze)
const FIRE_AND_FORGET_COMMANDS = [
  'workbench.action.terminal.killAll',
  'workbench.action.terminal.kill',
  'workbench.action.closeAllEditors',
  'workbench.action.closeAllGroups',
  'workbench.action.reloadWindow',
  'workbench.action.togglePanel',
  'workbench.action.toggleSidebarVisibility',
];

export class ExecuteCommandTool implements vscode.LanguageModelTool<IExecuteCommandParams> {
  constructor(private outputChannel: OutputChannel) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IExecuteCommandParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const cmd = options.input.command;
    
    // Warn about dangerous commands
    const dangerous = ['workbench.action.quit', 'workbench.action.closeWindow'];
    if (dangerous.includes(cmd)) {
      return {
        invocationMessage: `Executing ${cmd}...`,
        confirmationMessages: {
          title: 'Dangerous Command',
          message: new vscode.MarkdownString(
            `**WARNING**: \`${cmd}\` may close VS Code or lose unsaved work.\n\nProceed?`
          ),
        },
      };
    }
    
    return {
      invocationMessage: `Executing ${cmd}...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IExecuteCommandParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { command, args, fireAndForget: explicitFireAndForget } = options.input;
    
    // Determine if we should fire-and-forget
    const shouldFireAndForget = explicitFireAndForget ?? FIRE_AND_FORGET_COMMANDS.includes(command);
    
    this.outputChannel.appendLine(
      `ExecuteCommandTool: Running ${command} (fireAndForget=${shouldFireAndForget}) with args: ${JSON.stringify(args)}`
    );
    
    try {
      if (shouldFireAndForget) {
        // Fire and forget - don't await, return immediately
        vscode.commands.executeCommand(command, ...(args || [])).then(
          () => this.outputChannel.appendLine(`ExecuteCommandTool: ${command} completed (async)`),
          (err) => this.outputChannel.appendLine(`ExecuteCommandTool: ${command} failed (async): ${err}`)
        );
        
        const response = {
          success: true,
          command,
          mode: 'fireAndForget',
          message: 'Command dispatched. Check output channel for completion status.',
        };
        
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
        ]);
      }
      
      // Normal synchronous execution
      const result = await vscode.commands.executeCommand(command, ...(args || []));
      
      const response = {
        success: true,
        command,
        mode: 'sync',
        result: result !== undefined ? String(result) : null,
      };
      
      this.outputChannel.appendLine(`ExecuteCommandTool: Success - ${JSON.stringify(response)}`);
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.outputChannel.appendLine(`ExecuteCommandTool: Error - ${error}`);
      throw new Error(`Command failed: ${error}`);
    }
  }
}
