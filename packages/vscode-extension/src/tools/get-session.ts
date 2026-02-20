/**
 * Get Session Tool
 * Get detailed information about a specific chat session by ID
 * 
 * SAFE VERSION - With pagination to prevent bot-killing
 * 
 * Fixed by: ALTAIR 0.0.Q (Q52)
 * Date: 2026-01-25
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IGetSessionParams, PaginationInfo, SAFETY_LIMITS } from '../types';
import { getAppDataPath, parseSessionFile } from '../utils';

export class GetSessionTool implements vscode.LanguageModelTool<IGetSessionParams> {
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
    const { sessionId, includeHistory, fromIndex: rawFromIndex, limit: rawLimit } = options.input;
    
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
          // Try .jsonl first (current format), then .json (legacy)
          const candidates = [
            path.join(sessionsDir, `${sessionId}.jsonl`),
            path.join(sessionsDir, `${sessionId}.json`),
          ];

          for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
              sessionData = parseSessionFile(candidate);
              if (sessionData) {
                foundHash = hash;
                sessionPath = candidate;
                break;
              }
            }
          }
          if (sessionData) break;
        }
      }

      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Extract key information
      const requests = sessionData.requests || [];
      const totalCount = requests.length;
      
      // Count ONLY summarizer-full events (true reboots)
      // See: ___/protocols/REBOOT_DEFINITION.md for canonical specification
      let rebootCount = 0;
      for (const req of requests) {
        for (const resp of (req.response || [])) {
          if (resp.kind === 'progressTaskSerialized') {
            const content = resp.content || {};
            if (content.value === 'Summarized conversation history') {
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
        requestCount: totalCount,
        rebootCount,
        initialLocation: sessionData.initialLocation,
        version: sessionData.version,
      };
      
      // Handle message history with SAFE pagination
      const wantsHistory = includeHistory || rawFromIndex !== undefined || rawLimit !== undefined;
      
      if (wantsHistory) {
        // Apply safety limits - NEVER return unbounded data
        const limit = Math.min(
          Math.max(1, rawLimit || SAFETY_LIMITS.GET_SESSION_DEFAULT_MESSAGES),
          SAFETY_LIMITS.GET_SESSION_MAX_MESSAGES
        );
        
        // Handle negative fromIndex (e.g., -5 means "last 5")
        let fromIndex: number;
        if (rawFromIndex !== undefined && rawFromIndex < 0) {
          fromIndex = Math.max(0, totalCount + rawFromIndex);
        } else {
          fromIndex = Math.max(0, rawFromIndex || 0);
        }
        
        // Calculate actual range
        const toIndex = Math.min(fromIndex + limit, totalCount);
        const slice = requests.slice(fromIndex, toIndex);
        
        // Build pagination info for safe navigation
        const pagination: PaginationInfo = {
          totalCount,
          returnedCount: slice.length,
          fromIndex,
          toIndex: toIndex - 1,  // Inclusive end index
          hasMore: toIndex < totalCount,
          hasPrevious: fromIndex > 0,
        };
        
        output.pagination = pagination;
        
        // Map only the sliced messages
        output.history = slice.map((req: any, i: number) => {
          const actualIndex = fromIndex + i;
          return {
            index: actualIndex,
            timestamp: req.timestamp ? new Date(req.timestamp).toISOString() : null,
            message: req.message?.text?.slice(0, 200) + (req.message?.text?.length > 200 ? '...' : ''),
            hasResponse: (req.response || []).length > 0,
            responseTypes: [...new Set((req.response || []).map((r: any) => r.kind))],
          };
        });
        
        // Add navigation hints for agents
        output.navigation = {
          nextPage: pagination.hasMore ? `fromIndex=${toIndex}&limit=${limit}` : null,
          prevPage: pagination.hasPrevious ? `fromIndex=${Math.max(0, fromIndex - limit)}&limit=${limit}` : null,
        };
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
