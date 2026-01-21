import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log('Qopilot v0.1.0 activating...');
  
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('Qopilot');
  context.subscriptions.push(outputChannel);
  
  outputChannel.appendLine('Qopilot v0.1.0 starting...');
  outputChannel.appendLine('');
  outputChannel.appendLine('Architecture: VS Code Language Model Tools API (native)');
  outputChannel.appendLine('');

  // Register manual command for humans
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
  
  // Command to show output channel
  const showLogsCmd = vscode.commands.registerCommand(
    'qopilot.showLogs',
    () => outputChannel.show()
  );
  context.subscriptions.push(showLogsCmd);

  // Command to show Q-semver designation
  const showQSemverCmd = vscode.commands.registerCommand(
    'qopilot.showQSemver',
    async () => {
      const qInfo = await computeQSemver();
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
      
      // Show in info message
      vscode.window.showInformationMessage(
        `Qopilot: ${qInfo.qSemver} | ${qInfo.workspaceType} | Session ${qInfo.chatSessionId?.slice(0,8) || 'unknown'}...`
      );
    }
  );
  context.subscriptions.push(showQSemverCmd);

  // === REGISTER LANGUAGE MODEL TOOLS ===
  registerSessionTools(context);

  console.log('Qopilot v0.1.0 activated');
  vscode.window.showInformationMessage('Qopilot v0.1.0 active');
}

// Q-Semver computation
interface QSemverInfo {
  sessionId: string;
  chatSessionId: string | null;
  machineId: string;
  workspaceType: 'husk' | 'nucleus' | 'untitled';
  isMultiRoot: boolean;
  chronosQ: number;      // CQ: chronological birth order (1-indexed)
  kairosQ: number | null; // KQ: kairotic role (0.0 = husk, 0.5+ = quest)
  minorVersion: number;  // DEPRECATED: use chronosQ
  patchVersion: number;  // progressTaskSerialized count (reboots)
  qSemver: string;       // "0.X.Y" format (X = chronosQ)
  qSemverKairos: string | null; // "0.X.Y" format (X = kairosQ) if assigned
  roleName: string | null; // Human-readable role (e.g., "husk overseer")
  details: QSemverDetails;
}

interface QSemverDetails {
  appDataPath: string;
  huskHash: string | null;
  nucleusHash: string | null;
  huskSessionCount: number;
  nucleusSessions: SessionInfo[];
  currentSessionIndex: number;
  workspaceFile: string | null;
  folderUri: string | null;
}

interface SessionInfo {
  id: string;
  creationDate: number;
  firstMessageTime: number;
  requestCount: number;
  rebootCount: number;
  modifiedTime: number;
  isCurrent: boolean;
  customTitle: string | null;
  kairosQ: number | null;  // Parsed from customTitle (e.g., 0.0, 0.5, 0.6)
  roleName: string | null;  // Derived from kairosQ
  questEmoji: string | null; // Emoji markers from customTitle
}

// === Q-SEMVER CONFIGURATION ===
const Q_CONFIG = {
  HUSK_MINOR: 0,              // Husk sessions get minor=0
  NUCLEUS_MINOR_START: 1,     // Nucleus sessions start at 1
  REQUIRE_REQUESTS: true,     // Only count sessions with messages
};

// Parse kairotic Q from customTitle (e.g., "/AS/0.0.Q/" or "/AS/0.5.Q/")
function parseKairosQ(customTitle: string | null): number | null {
  if (!customTitle) return null;
  
  // Match patterns: /AS/0.0.Q/ or /AS/0.5.Q/ or /0.0.Q/ etc
  const match = customTitle.match(/\/(?:AS\/)?(\d+\.\d+)\.Q\//i);
  if (match) {
    return parseFloat(match[1]);
  }
  
  return null;
}

// Extract emoji quest markers from customTitle
function extractQuestEmoji(customTitle: string | null): string | null {
  if (!customTitle) return null;
  
  // Find emoji at end of title after last /
  const parts = customTitle.split('/');
  const lastPart = parts[parts.length - 2]; // Second to last (last is empty after trailing /)
  
  // Check if it contains emoji
  if (lastPart && /[\u{1F000}-\u{1FFFF}]/u.test(lastPart)) {
    return lastPart;
  }
  
  return null;
}

// Map kairotic Q to role name
function getRoleName(kairosQ: number | null): string | null {
  if (kairosQ === null) return null;
  
  if (kairosQ === 0.0) return 'husk overseer';
  if (kairosQ >= 0.1 && kairosQ < 0.5) return 'infrastructure';
  if (kairosQ >= 0.5 && kairosQ < 1.0) return 'quester';
  if (kairosQ >= 1.0) return 'domain specialist';
  
  return 'unknown role';
}

// Get VS Code AppData path
function getAppDataPath(): string {
  const appName = vscode.env.appName.includes('Insiders') ? 'Code - Insiders' : 'Code';
  
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', appName, 'User');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName, 'User');
    default: // linux
      return path.join(os.homedir(), '.config', appName, 'User');
  }
}

// Get workspace URI for hash computation
function getWorkspaceUri(): { uri: string; type: 'husk' | 'nucleus' | 'untitled' } {
  const workspaceFile = vscode.workspace.workspaceFile;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (workspaceFile && workspaceFile.scheme === 'file') {
    // Multi-root workspace file
    return { 
      uri: `file:///${workspaceFile.fsPath.replace(/\\/g, '/').replace(/^\//, '')}`,
      type: 'nucleus'
    };
  } else if (workspaceFolders && workspaceFolders.length > 0) {
    // Single folder (husk)
    const folderUri = workspaceFolders[0].uri;
    return {
      uri: `file:///${folderUri.fsPath.replace(/\\/g, '/').replace(/^\//, '')}`,
      type: 'husk'
    };
  }
  
  return { uri: '', type: 'untitled' };
}

// Find workspace hash by searching workspace.json files
function findWorkspaceHash(appDataPath: string, targetPath: string, type: 'husk' | 'nucleus'): string | null {
  const storageBase = path.join(appDataPath, 'workspaceStorage');
  
  if (!fs.existsSync(storageBase)) {
    return null;
  }
  
  // Normalize the target path for comparison
  // VS Code stores URIs like: file:///c%3A/www/VGM9 (with %3A for colon)
  const normalizedTarget = targetPath.toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^\//, '');
  
  for (const hash of fs.readdirSync(storageBase)) {
    const wsFile = path.join(storageBase, hash, 'workspace.json');
    if (fs.existsSync(wsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(wsFile, 'utf-8'));
        
        // For husk (single folder), check 'folder' key
        // For nucleus (multi-root workspace), check 'workspace' key
        const wsValue = type === 'husk' 
          ? (data.folder || '') 
          : (data.workspace || '');
        
        if (!wsValue) continue;
        
        // Decode and normalize the stored URI for comparison
        const decodedValue = decodeURIComponent(wsValue)
          .toLowerCase()
          .replace(/^file:\/\/\//, '')
          .replace(/\\/g, '/');
        
        // Check if paths match
        if (decodedValue === normalizedTarget || 
            decodedValue.includes(normalizedTarget) || 
            normalizedTarget.includes(decodedValue)) {
          return hash;
        }
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

// Read sessions from a workspace storage hash
function readSessions(appDataPath: string, hash: string): SessionInfo[] {
  const sessionsDir = path.join(appDataPath, 'workspaceStorage', hash, 'chatSessions');
  
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }
  
  const sessions: SessionInfo[] = [];
  
  for (const file of fs.readdirSync(sessionsDir)) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const filePath = path.join(sessionsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const requests = data.requests || [];
      
      // Count progressTaskSerialized markers (reboots)
      let rebootCount = 0;
      for (const req of requests) {
        for (const resp of (req.response || [])) {
          if (resp.kind === 'progressTaskSerialized') {
            const content = resp.content || {};
            if ((content.value || '').includes('Summarized')) {
              rebootCount++;
            }
          }
        }
      }
      
      // Get first message time
      let firstMessageTime = data.creationDate || 0;
      if (requests.length > 0 && requests[0].timestamp) {
        firstMessageTime = requests[0].timestamp;
      }
      
      const sessionId = data.sessionId || file.replace('.json', '');
      
      // Get file modification time to help identify current session
      const stats = fs.statSync(filePath);
      const modifiedTime = stats.mtimeMs;
      
      // Parse customTitle for kairotic Q and emoji
      const customTitle = data.customTitle || null;
      const kairosQ = parseKairosQ(customTitle);
      const roleName = getRoleName(kairosQ);
      const questEmoji = extractQuestEmoji(customTitle);
      
      sessions.push({
        id: sessionId,
        creationDate: data.creationDate || 0,
        firstMessageTime,
        requestCount: requests.length,
        rebootCount,
        modifiedTime,
        isCurrent: false,  // Will be set later
        customTitle,
        kairosQ,
        roleName,
        questEmoji
      });
    } catch {
      continue;
    }
  }
  
  return sessions;
}

// Find current chat session - most recently modified session with requests
function findCurrentChatSession(sessions: SessionInfo[]): SessionInfo | null {
  // Find sessions with requests, sorted by modification time (most recent first)
  const withRequests = sessions.filter(s => s.requestCount > 0);
  if (withRequests.length === 0) return null;
  
  withRequests.sort((a, b) => b.modifiedTime - a.modifiedTime);
  
  // The most recently modified session with requests is likely current
  const current = withRequests[0];
  current.isCurrent = true;
  return current;
}

async function computeQSemver(): Promise<QSemverInfo> {
  const sessionId = vscode.env.sessionId;
  const machineId = vscode.env.machineId;
  const appDataPath = getAppDataPath();
  
  // Get current workspace info
  const { uri: workspaceUri, type: workspaceType } = getWorkspaceUri();
  const isMultiRoot = workspaceType === 'nucleus';
  
  // Find workspace hashes
  let huskHash: string | null = null;
  let nucleusHash: string | null = null;
  
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceFile = vscode.workspace.workspaceFile;
  
  // For nucleus, find both husk and nucleus hashes
  if (workspaceType === 'nucleus' && workspaceFile) {
    // Find nucleus hash using workspace file path
    nucleusHash = findWorkspaceHash(appDataPath, workspaceFile.fsPath, 'nucleus');
    
    // Find husk hash using primary folder path
    if (workspaceFolders && workspaceFolders.length > 0) {
      huskHash = findWorkspaceHash(appDataPath, workspaceFolders[0].uri.fsPath, 'husk');
    }
  } else if (workspaceType === 'husk' && workspaceFolders && workspaceFolders.length > 0) {
    huskHash = findWorkspaceHash(appDataPath, workspaceFolders[0].uri.fsPath, 'husk');
  }
  
  // Read sessions from both locations
  const huskSessions = huskHash ? readSessions(appDataPath, huskHash) : [];
  const nucleusSessions = nucleusHash ? readSessions(appDataPath, nucleusHash) : [];
  
  // Filter to sessions with requests if required
  const huskWithRequests = Q_CONFIG.REQUIRE_REQUESTS 
    ? huskSessions.filter(s => s.requestCount > 0)
    : huskSessions;
  const nucleusWithRequests = Q_CONFIG.REQUIRE_REQUESTS
    ? nucleusSessions.filter(s => s.requestCount > 0)
    : nucleusSessions;
  
  // Sort nucleus sessions by first message time
  nucleusWithRequests.sort((a, b) => a.firstMessageTime - b.firstMessageTime);
  
  // Find current session
  const allSessions = [...huskWithRequests, ...nucleusWithRequests];
  const currentSession = findCurrentChatSession(allSessions);
  const chatSessionId = currentSession?.id || null;
  
  // Compute minor version
  let minorVersion = 0;
  let currentSessionIndex = -1;
  
  if (workspaceType === 'husk' && huskWithRequests.length > 0) {
    // Husk gets minor=0
    minorVersion = Q_CONFIG.HUSK_MINOR;
    currentSessionIndex = 0;
  } else if (workspaceType === 'nucleus') {
    // Nucleus sessions start at 1
    const currentIndex = nucleusWithRequests.findIndex(s => 
      s.id === chatSessionId || s.isCurrent
    );
    if (currentIndex >= 0) {
      minorVersion = Q_CONFIG.NUCLEUS_MINOR_START + currentIndex;
      currentSessionIndex = currentIndex;
    } else {
      // Fallback: use total count
      minorVersion = Q_CONFIG.NUCLEUS_MINOR_START + nucleusWithRequests.length - 1;
      currentSessionIndex = nucleusWithRequests.length - 1;
    }
  }
  
  // Get patch version (reboot count)
  const patchVersion = currentSession?.rebootCount || 0;
  
  // Chronos Q (birth order)
  const chronosQ = minorVersion;
  
  // Kairos Q (role assignment from customTitle)
  const kairosQ = currentSession?.kairosQ || null;
  const roleName = currentSession?.roleName || null;
  
  // Construct Q-semver strings
  const qSemver = `0.${chronosQ}.${patchVersion}`;
  const qSemverKairos = kairosQ !== null ? `0.${kairosQ}.${patchVersion}` : null;
  
  return {
    sessionId,
    chatSessionId,
    machineId,
    workspaceType,
    isMultiRoot,
    chronosQ,
    kairosQ,
    minorVersion: chronosQ, // Keep for backward compatibility
    patchVersion,
    qSemver,
    qSemverKairos,
    roleName,
    details: {
      appDataPath,
      huskHash,
      nucleusHash,
      huskSessionCount: huskWithRequests.length,
      nucleusSessions: nucleusWithRequests,
      currentSessionIndex,
      workspaceFile: vscode.workspace.workspaceFile?.fsPath || null,
      folderUri: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null,
    }
  };
}

// === SESSION TOOLS ===
// These tools provide session discovery and (limited) interaction capabilities

interface IListSessionsParams {
  workspaceHash?: string;  // Optional: specific hash, otherwise uses current workspace
  includeEmpty?: boolean;  // Include sessions with 0 requests
}

interface IGetSessionParams {
  sessionId: string;
  includeHistory?: boolean;  // Include full message history
}

interface ISendMessageParams {
  sessionId: string;
  message: string;
}

class ListSessionsTool implements vscode.LanguageModelTool<IListSessionsParams> {
  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<IListSessionsParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Listing chat sessions from AppData...',
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IListSessionsParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const appDataPath = getAppDataPath();
      const { type: workspaceType } = getWorkspaceUri();
      const includeEmpty = options.input.includeEmpty ?? false;
      
      // Find workspace hashes
      let huskHash: string | null = null;
      let nucleusHash: string | null = null;
      
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceFile = vscode.workspace.workspaceFile;
      
      if (workspaceType === 'nucleus' && workspaceFile) {
        nucleusHash = findWorkspaceHash(appDataPath, workspaceFile.fsPath, 'nucleus');
        if (workspaceFolders && workspaceFolders.length > 0) {
          huskHash = findWorkspaceHash(appDataPath, workspaceFolders[0].uri.fsPath, 'husk');
        }
      } else if (workspaceType === 'husk' && workspaceFolders && workspaceFolders.length > 0) {
        huskHash = findWorkspaceHash(appDataPath, workspaceFolders[0].uri.fsPath, 'husk');
      }
      
      // Read sessions
      const huskSessions = huskHash ? readSessions(appDataPath, huskHash) : [];
      const nucleusSessions = nucleusHash ? readSessions(appDataPath, nucleusHash) : [];
      
      // Filter and combine
      const allSessions = [
        ...huskSessions.map(s => ({ ...s, source: 'husk', hash: huskHash })),
        ...nucleusSessions.map(s => ({ ...s, source: 'nucleus', hash: nucleusHash }))
      ].filter(s => includeEmpty || s.requestCount > 0);
      
      // Sort by modification time (most recent first)
      allSessions.sort((a, b) => b.modifiedTime - a.modifiedTime);
      
      // Format output
      const output = {
        workspaceType,
        huskHash,
        nucleusHash,
        totalSessions: allSessions.length,
        sessions: allSessions.map((s, i) => ({
          index: i,
          sessionId: s.id,
          source: s.source,
          requestCount: s.requestCount,
          rebootCount: s.rebootCount,
          customTitle: s.customTitle,
          kairosQ: s.kairosQ,
          roleName: s.roleName,
          firstMessageTime: new Date(s.firstMessageTime).toISOString(),
          modifiedTime: new Date(s.modifiedTime).toISOString(),
          isCurrent: s.isCurrent,
        }))
      };
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(output, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to list sessions: ${error}`);
    }
  }
}

class GetSessionTool implements vscode.LanguageModelTool<IGetSessionParams> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IGetSessionParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Getting session ${options.input.sessionId.slice(0, 8)}...`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IGetSessionParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { sessionId, includeHistory } = options.input;
    
    try {
      const appDataPath = getAppDataPath();
      const storageBase = path.join(appDataPath, 'workspaceStorage');
      
      // Search all workspace storage directories for the session
      let sessionData: any = null;
      let foundHash: string | null = null;
      let sessionPath: string | null = null;
      
      if (fs.existsSync(storageBase)) {
        for (const hash of fs.readdirSync(storageBase)) {
          const sessionsDir = path.join(storageBase, hash, 'chatSessions');
          const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
          
          if (fs.existsSync(sessionFile)) {
            sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
            foundHash = hash;
            sessionPath = sessionFile;
            break;
          }
        }
      }
      
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Extract key information
      const requests = sessionData.requests || [];
      
      // Count reboots
      let rebootCount = 0;
      for (const req of requests) {
        for (const resp of (req.response || [])) {
          if (resp.kind === 'progressTaskSerialized') {
            const content = resp.content || {};
            if ((content.value || '').includes('Summarized')) {
              rebootCount++;
            }
          }
        }
      }
      
      const output: any = {
        sessionId: sessionData.sessionId,
        workspaceHash: foundHash,
        sessionPath,
        creationDate: sessionData.creationDate ? new Date(sessionData.creationDate).toISOString() : null,
        customTitle: sessionData.customTitle || null,
        requestCount: requests.length,
        rebootCount,
        initialLocation: sessionData.initialLocation,
        version: sessionData.version,
      };
      
      // Optionally include message history
      if (includeHistory) {
        output.history = requests.map((req: any, i: number) => ({
          index: i,
          timestamp: req.timestamp ? new Date(req.timestamp).toISOString() : null,
          message: req.message?.text?.slice(0, 200) + (req.message?.text?.length > 200 ? '...' : ''),
          hasResponse: (req.response || []).length > 0,
          responseTypes: [...new Set((req.response || []).map((r: any) => r.kind))],
        }));
      }
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(output, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to get session: ${error}`);
    }
  }
}

class SendMessageToSessionTool implements vscode.LanguageModelTool<ISendMessageParams> {
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

function registerSessionTools(context: vscode.ExtensionContext) {
  outputChannel.appendLine('Registering Language Model Tools...');
  
  context.subscriptions.push(
    vscode.lm.registerTool('qopilot_list_sessions', new ListSessionsTool())
  );
  outputChannel.appendLine('  ✓ qopilot_list_sessions (#sessions)');
  
  context.subscriptions.push(
    vscode.lm.registerTool('qopilot_get_session', new GetSessionTool())
  );
  outputChannel.appendLine('  ✓ qopilot_get_session (#getsession)');
  
  context.subscriptions.push(
    vscode.lm.registerTool('qopilot_send_message', new SendMessageToSessionTool())
  );
  outputChannel.appendLine('  ✓ qopilot_send_message (#sendmsg) [LIMITED - file-based only]');
  
  outputChannel.appendLine('Language Model Tools registered.');
}

export function deactivate() {
  console.log('Qopilot deactivated');
}
