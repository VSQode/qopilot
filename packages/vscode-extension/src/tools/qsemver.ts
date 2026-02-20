/**
 * Q-Semver Tool
 * Computes and returns the agent's Q-Semver identity
 */

import * as vscode from 'vscode';
import { 
  IQSemverParams, 
  QSemverInfo, 
  Q_CONFIG 
} from '../types';
import { 
  getAppDataPath, 
  getWorkspaceUri, 
  findWorkspaceHash, 
  readSessions, 
  findCurrentChatSession 
} from '../utils';

/**
 * Compute the full Q-Semver identity for the current session
 */
export async function computeQSemver(): Promise<QSemverInfo> {
  const sessionId = vscode.env.sessionId;
  const machineId = vscode.env.machineId;
  const appDataPath = getAppDataPath();
  
  // Get current workspace info
  const { type: workspaceType } = getWorkspaceUri();
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

export class QSemverTool implements vscode.LanguageModelTool<IQSemverParams> {
  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<IQSemverParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Computing Q-Semver identity...',
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IQSemverParams>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const includeDetails = options.input.includeDetails ?? false;
      const minimal = options.input.minimal ?? false;
      const qInfo = await computeQSemver();
      
      // Minimal mode: just what an agent needs on wake (< 50 tokens)
      if (minimal) {
        const result = {
          chatSessionId: qInfo.chatSessionId,
          rebootCount: qInfo.patchVersion,
          qSemver: qInfo.qSemver,
        };
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(result))
        ]);
      }
      
      const summary = {
        identity: {
          sessionId: qInfo.sessionId,
          chatSessionId: qInfo.chatSessionId,
          machineId: qInfo.machineId
        },
        chronosQ: {
          qSemver: qInfo.qSemver,
          meaning: `${qInfo.chronosQ}${qInfo.chronosQ === 1 ? 'st' : qInfo.chronosQ === 2 ? 'nd' : qInfo.chronosQ === 3 ? 'rd' : 'th'} session created, ${qInfo.patchVersion} reboot${qInfo.patchVersion === 1 ? '' : 's'}`,
          birthOrder: qInfo.chronosQ,
          rebootCount: qInfo.patchVersion
        },
        kairosQ: qInfo.kairosQ !== null ? {
          qSemver: qInfo.qSemverKairos,
          role: qInfo.roleName,
          roleNumber: qInfo.kairosQ,
          tenureReboots: qInfo.patchVersion
        } : null,
        workspace: {
          type: qInfo.workspaceType,
          isMultiRoot: qInfo.isMultiRoot
        }
      };
      
      const result = includeDetails ? {
        summary,
        details: qInfo.details
      } : summary;
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2))
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to compute Q-Semver: ${error}`);
    }
  }
}
