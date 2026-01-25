/**
 * Qopilot Extension
 * VS Code Language Model Tools for agent identity and session management
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Q_CONFIG } from './types';
import {
  QSemverTool,
  computeQSemver,
  ListSessionsTool,
  GetSessionTool,
  SendMessageTool,
  McpControlTool,
  McpOutputTool,
  AttachFileTool,
  ExecuteCommandTool,
  ReadOutputTool
} from './tools';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log('Qopilot v0.1.0 activating...');
  
  // Create output channel
  outputChannel = vscode.window.createOutputChannel('Qopilot');
  context.subscriptions.push(outputChannel);
  
  outputChannel.appendLine('Qopilot v0.1.0 starting...');
  outputChannel.appendLine('');
  outputChannel.appendLine('Architecture: VS Code Language Model Tools API (native)');
  outputChannel.appendLine('');

  // Register user commands
  registerCommands(context);
  
  // Register language model tools
  registerTools(context);

  console.log('Qopilot v0.1.0 activated');
  vscode.window.showInformationMessage('Qopilot v0.1.0 active');
}

function registerCommands(context: vscode.ExtensionContext) {
  // Manual file attachment for humans
  const attachFileCmd = vscode.commands.registerCommand(
    'qopilot.attachFile',
    async (uri?: vscode.Uri) => {
      if (!uri) {
        const files = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: 'Attach to Chat'
        });
        if (files && files.length > 0) {
          uri = files[0];
        }
      }

      if (uri) {
        await vscode.commands.executeCommand('workbench.action.chat.attachFile', uri);
        vscode.window.showInformationMessage(`Qopilot: Attached ${path.basename(uri.fsPath)}`);
      }
    }
  );
  context.subscriptions.push(attachFileCmd);
  
  // Show output channel
  const showLogsCmd = vscode.commands.registerCommand(
    'qopilot.showLogs',
    () => outputChannel.show()
  );
  context.subscriptions.push(showLogsCmd);

  // Show Q-semver identity
  const showQSemverCmd = vscode.commands.registerCommand(
    'qopilot.showQSemver',
    async () => {
      const qInfo = await computeQSemver();
      displayQSemverInfo(qInfo);
    }
  );
  context.subscriptions.push(showQSemverCmd);
}

async function displayQSemverInfo(qInfo: Awaited<ReturnType<typeof computeQSemver>>) {
  outputChannel.appendLine('');
  outputChannel.appendLine('═══════════════════════════════════════════════════════════');
  outputChannel.appendLine(`  Q-SEMVER IDENTITY`);
  outputChannel.appendLine('═══════════════════════════════════════════════════════════');
  outputChannel.appendLine('');
  outputChannel.appendLine('── Core Identity ──');
  outputChannel.appendLine(`  VS Code Session ID: ${qInfo.sessionId}`);
  outputChannel.appendLine(`  Chat Session ID:    ${qInfo.chatSessionId || 'unknown'}`);
  outputChannel.appendLine(`  Machine ID:         ${qInfo.machineId}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('── Chronos (Birth Order) ──');
  outputChannel.appendLine(`  CQ:      ${qInfo.qSemver}`);
  outputChannel.appendLine(`  Meaning: ${qInfo.chronosQ}${qInfo.chronosQ === 1 ? 'st' : qInfo.chronosQ === 2 ? 'nd' : qInfo.chronosQ === 3 ? 'rd' : 'th'} session created, ${qInfo.patchVersion} reboot${qInfo.patchVersion === 1 ? '' : 's'}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('── Kairos (Role) ──');
  if (qInfo.kairosQ !== null) {
    outputChannel.appendLine(`  KQ:      ${qInfo.qSemverKairos}`);
    outputChannel.appendLine(`  Meaning: ${qInfo.roleName || 'unknown role'}, ${qInfo.patchVersion} reboot${qInfo.patchVersion === 1 ? '' : 's'}`);
    outputChannel.appendLine(`  Role:    ${qInfo.roleName || 'unknown'}`);
  } else {
    outputChannel.appendLine(`  KQ:      (not assigned)`);
    outputChannel.appendLine(`  Meaning: No customTitle role marker found`);
  }
  outputChannel.appendLine('');
  outputChannel.appendLine('── Workspace Type ──');
  outputChannel.appendLine(`  Type: ${qInfo.workspaceType} (${qInfo.isMultiRoot ? 'multi-root' : 'single-root'})`);
  outputChannel.appendLine(`  Workspace File: ${qInfo.details.workspaceFile || 'none'}`);
  outputChannel.appendLine(`  Primary Folder: ${qInfo.details.folderUri || 'none'}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('── Storage Hashes ──');
  outputChannel.appendLine(`  Husk Hash:    ${qInfo.details.huskHash || 'none'}`);
  outputChannel.appendLine(`  Nucleus Hash: ${qInfo.details.nucleusHash || 'none'}`);
  outputChannel.appendLine(`  AppData Path: ${qInfo.details.appDataPath}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('── Session Chronology ──');
  outputChannel.appendLine(`  Husk sessions (with requests): ${qInfo.details.huskSessionCount}`);
  outputChannel.appendLine(`  Nucleus sessions: ${qInfo.details.nucleusSessions.length}`);
  outputChannel.appendLine('');
  
  for (let i = 0; i < qInfo.details.nucleusSessions.length; i++) {
    const s = qInfo.details.nucleusSessions[i];
    const minor = Q_CONFIG.NUCLEUS_MINOR_START + i;
    const marker = s.isCurrent || s.id === qInfo.chatSessionId ? ' ← CURRENT' : '';
    const date = new Date(s.firstMessageTime).toISOString();
    const kqLabel = s.kairosQ !== null ? ` KQ=${s.kairosQ}` : '';
    const emoji = s.questEmoji ? ` ${s.questEmoji}` : '';
    outputChannel.appendLine(`    CQ=${minor}: ${s.id.slice(0,12)}...${kqLabel} | req=${s.requestCount} patch=${s.rebootCount}${emoji} | ${date}${marker}`);
  }
  
  outputChannel.appendLine('');
  outputChannel.appendLine('── Configuration ──');
  outputChannel.appendLine(`  HUSK_MINOR: ${Q_CONFIG.HUSK_MINOR}`);
  outputChannel.appendLine(`  NUCLEUS_MINOR_START: ${Q_CONFIG.NUCLEUS_MINOR_START}`);
  outputChannel.appendLine(`  REQUIRE_REQUESTS: ${Q_CONFIG.REQUIRE_REQUESTS}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('═══════════════════════════════════════════════════════════');
  outputChannel.appendLine('');
  outputChannel.show();
  
  vscode.window.showInformationMessage(
    `Qopilot: ${qInfo.qSemver} | ${qInfo.workspaceType} | Session ${qInfo.chatSessionId?.slice(0,8) || 'unknown'}...`
  );
}

function registerTools(context: vscode.ExtensionContext) {
  outputChannel.appendLine('Registering Language Model Tools...');
  
  // Session management tools
  context.subscriptions.push(vscode.lm.registerTool('qopilot_get_qsemver', new QSemverTool()));
  outputChannel.appendLine('  ✓ qopilot_get_qsemver (#qsemver)');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_list_sessions', new ListSessionsTool()));
  outputChannel.appendLine('  ✓ qopilot_list_sessions (#sessions)');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_get_session', new GetSessionTool()));
  outputChannel.appendLine('  ✓ qopilot_get_session (#getsession)');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_send_message', new SendMessageTool()));
  outputChannel.appendLine('  ✓ qopilot_send_message (#sendmsg) [LIMITED - file-based only]');
  
  // MCP management tools
  context.subscriptions.push(vscode.lm.registerTool('qopilot_mcp_control', new McpControlTool()));
  outputChannel.appendLine('  ✓ qopilot_mcp_control (#mcp) - start/stop/restart MCP servers');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_mcp_output', new McpOutputTool()));
  outputChannel.appendLine('  ✓ qopilot_mcp_output (#mcplog) - read MCP server output');
  
  // File and command tools
  context.subscriptions.push(vscode.lm.registerTool('qopilot_attach_file', new AttachFileTool(outputChannel)));
  outputChannel.appendLine('  ✓ qopilot_attach_file (#attach)');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_execute_command', new ExecuteCommandTool(outputChannel)));
  outputChannel.appendLine('  ✓ qopilot_execute_command (#cmd)');
  
  context.subscriptions.push(vscode.lm.registerTool('qopilot_read_output', new ReadOutputTool()));
  outputChannel.appendLine('  ✓ qopilot_read_output (#output) - read any output channel');
  
  outputChannel.appendLine('');
  outputChannel.appendLine('All Language Model Tools registered.');
}

export function deactivate() {
  console.log('Qopilot deactivated');
}
