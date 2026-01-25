/**
 * Session Utilities
 * Helper functions for reading and parsing chat sessions
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionInfo } from '../types';

/**
 * Parse kairotic Q from customTitle (e.g., "/AS/0.0.Q/" or "/AS/0.5.Q/")
 */
export function parseKairosQ(customTitle: string | null): number | null {
  if (!customTitle) return null;
  
  // Match patterns: /AS/0.0.Q/ or /AS/0.5.Q/ or /0.0.Q/ etc
  const match = customTitle.match(/\/(?:AS\/)?(\d+\.\d+)\.Q\//i);
  if (match) {
    return parseFloat(match[1]);
  }
  
  return null;
}

/**
 * Extract emoji quest markers from customTitle
 */
export function extractQuestEmoji(customTitle: string | null): string | null {
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

/**
 * Map kairotic Q to role name
 */
export function getRoleName(kairosQ: number | null): string | null {
  if (kairosQ === null) return null;
  
  if (kairosQ === 0.0) return 'husk overseer';
  if (kairosQ >= 0.1 && kairosQ < 0.5) return 'infrastructure';
  if (kairosQ >= 0.5 && kairosQ < 1.0) return 'quester';
  if (kairosQ >= 1.0) return 'domain specialist';
  
  return 'unknown role';
}

/**
 * Read sessions from a workspace storage hash
 */
export function readSessions(appDataPath: string, hash: string): SessionInfo[] {
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
      
      // Count ONLY summarizer-full events (true reboots)
      // See: ___/protocols/REBOOT_DEFINITION.md for canonical specification
      // The marker is: content.value === "Summarized conversation history"
      // TODO: Also check 'progressTask' for pre-June 2025 sessions (THESEUS Prime era)
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

/**
 * Find current chat session - most recently modified session with requests
 */
export function findCurrentChatSession(sessions: SessionInfo[]): SessionInfo | null {
  // Find sessions with requests, sorted by modification time (most recent first)
  const withRequests = sessions.filter(s => s.requestCount > 0);
  if (withRequests.length === 0) return null;
  
  withRequests.sort((a, b) => b.modifiedTime - a.modifiedTime);
  
  // The most recently modified session with requests is likely current
  const current = withRequests[0];
  current.isCurrent = true;
  return current;
}
