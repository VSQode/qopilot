/**
 * Attach File Tool
 * Returns image data to the LLM so it can "see" the file
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IAttachFileParams, OutputChannel } from '../types';

export class AttachFileTool implements vscode.LanguageModelTool<IAttachFileParams> {
  constructor(private outputChannel: OutputChannel) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IAttachFileParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const filename = path.basename(options.input.path);
    return {
      invocationMessage: `Attaching ${filename}...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IAttachFileParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const filePath = options.input.path;
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    
    const mime = mimeTypes[ext];
    if (!mime) {
      throw new Error(`Unsupported image type: ${ext}. Supported: ${Object.keys(mimeTypes).join(', ')}`);
    }
    
    // Read file and return as image data
    const data = fs.readFileSync(filePath);
    const uint8 = new Uint8Array(data);
    
    this.outputChannel.appendLine(`AttachFileTool: Returning ${filePath} as ${mime} (${uint8.length} bytes)`);
    
    return new vscode.LanguageModelToolResult([
      vscode.LanguageModelDataPart.image(uint8, mime)
    ]);
  }
}
