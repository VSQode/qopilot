/**
 * List Sessions Tool
 * Lists all chat sessions stored in VS Code AppData for the current workspace
 * 
 * SAFE VERSION - With pagination to prevent context death
 * Fixed by: ALTAIR 0.0.Q (Q53)
 */

import * as vscode from 'vscode';
import { IListSessionsParams, SAFETY_LIMITS, PaginationInfo } from '../types';
import { getAppDataPath, getWorkspaceUri, findWorkspaceHash, readSessions } from '../utils';

export class ListSessionsTool implements vscode.LanguageModelTool<IListSessionsParams> {
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
      const rawFromIndex = options.input.fromIndex;
      const rawLimit = options.input.limit;
      
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
      
      const totalCount = allSessions.length;
      
      // Apply safety limits for pagination
      const limit = Math.min(
        Math.max(1, rawLimit || SAFETY_LIMITS.LIST_SESSIONS_DEFAULT),
        SAFETY_LIMITS.LIST_SESSIONS_MAX
      );
      const fromIndex = Math.max(0, rawFromIndex || 0);
      const toIndex = Math.min(fromIndex + limit, totalCount);
      
      // Slice for pagination
      const paginatedSessions = allSessions.slice(fromIndex, toIndex);
      
      // Build pagination info
      const pagination: PaginationInfo = {
        totalCount,
        returnedCount: paginatedSessions.length,
        fromIndex,
        toIndex: toIndex - 1,
        hasMore: toIndex < totalCount,
        hasPrevious: fromIndex > 0,
      };
      
      // Format output
      const output = {
        workspaceType,
        huskHash,
        nucleusHash,
        pagination,
        sessions: paginatedSessions.map((s, i) => ({
          index: fromIndex + i,
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
        })),
        navigation: {
          nextPage: pagination.hasMore ? `fromIndex=${toIndex}&limit=${limit}` : null,
          prevPage: pagination.hasPrevious ? `fromIndex=${Math.max(0, fromIndex - limit)}&limit=${limit}` : null,
        },
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
