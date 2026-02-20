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
 * Parse a chat session from either .json (monolithic) or .jsonl (snapshot+patches) format.
 * Returns the session data object or null on failure.
 */
export function parseSessionFile(filePath: string): any | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trimEnd();

    if (filePath.endsWith('.jsonl')) {
      // JSONL: line 1 is kind:0 full snapshot, rest are kind:1 patches
      const lines = raw.split('\n').filter(l => l.trim());
      if (lines.length === 0) return null;

      const first = JSON.parse(lines[0]);
      if (first.kind !== 0) return null;
      let data = first.v;

      for (let i = 1; i < lines.length; i++) {
        const patch = JSON.parse(lines[i]);
        if (patch.kind !== 1 || !Array.isArray(patch.k)) continue;
        // Apply patch: walk the key path, set the leaf
        const keys: string[] = patch.k;
        let obj = data;
        for (let j = 0; j < keys.length - 1; j++) {
          const k = keys[j];
          if (obj[k] === undefined || obj[k] === null) {
            obj[k] = typeof keys[j + 1] === 'number' ? [] : {};
          }
          obj = obj[k];
        }
        obj[keys[keys.length - 1]] = patch.v;
      }
      return data;
    } else {
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
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
  const seenIds = new Set<string>();

  // Sort so .json comes before .jsonl — .jsonl wins if both exist (dedup below)
  const files = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.jsonl'))
    .sort();

  for (const file of files) {
    if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;
    try {
      const filePath = path.join(sessionsDir, file);
      const data = parseSessionFile(filePath);
      if (!data) continue;
      const requests = data.requests || [];

      // Deduplicate: if we already have this session ID (from .json), the .jsonl version replaces it
      const rawId = file.endsWith('.jsonl') ? file.replace('.jsonl', '') : file.replace('.json', '');
      const sessionId = data.sessionId || rawId;
      const existingIdx = sessions.findIndex(s => s.id === sessionId);
      if (existingIdx !== -1) {
        // .jsonl always supersedes .json (sorted order ensures .json was inserted first)
        sessions.splice(existingIdx, 1);
        seenIds.delete(sessionId);
      }
      
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
      seenIds.add(sessionId);
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
