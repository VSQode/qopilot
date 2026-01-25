/**
 * Send Message Tool
 * Attempts to send a message to another chat session via file-based inbox
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ISendMessageParams } from '../types';

export class SendMessageTool implements vscode.LanguageModelTool<ISendMessageParams> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ISendMessageParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Attempting to message session ${options.input.sessionId.slice(0, 8)}...`,
      confirmationMessages: {
        title: 'Send Message to Session',
        message: new vscode.MarkdownString(
          `**WARNING**: This tool has limited functionality.\n\n` +
          `VS Code does not expose an API to inject messages into existing chat sessions.\n\n` +
          `Session: \`${options.input.sessionId}\`\n\n` +
          `Message: ${options.input.message.slice(0, 100)}${options.input.message.length > 100 ? '...' : ''}\n\n` +
          `**What this tool CAN do:**\n` +
          `- Write message to a file-based inbox for the target session\n\n` +
          `**What this tool CANNOT do:**\n` +
          `- Directly inject text into another agent's conversation\n` +
          `- Send a message AS another session`
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ISendMessageParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { sessionId, message } = options.input;
    
    try {
      // Use workspace root for inbox (generic, not VGM9-specific)
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder open');
      }
      const inboxDir = path.join(workspaceRoot, '.qopilot', 'inbox');
      
      if (!fs.existsSync(inboxDir)) {
        fs.mkdirSync(inboxDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const messageId = crypto.randomBytes(8).toString('hex');
      const inboxFile = path.join(inboxDir, `msg_${timestamp}_${messageId}.json`);
      
      const envelope = {
        id: messageId,
        targetSession: sessionId,
        fromSession: vscode.env.sessionId,
        timestamp: new Date().toISOString(),
        message,
        status: 'pending',
      };
      
      fs.writeFileSync(inboxFile, JSON.stringify(envelope, null, 2));
      
      const result = {
        success: true,
        method: 'file-based inbox',
        inboxFile,
        envelope,
        note: 'Message written to inbox file. Target session must be watching their inbox to receive this message.',
        limitation: 'VS Code does not expose an API to directly inject messages into existing chat sessions.',
      };
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to send message: ${error}`);
    }
  }
}
