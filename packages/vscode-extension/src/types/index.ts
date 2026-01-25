/**
 * Qopilot Type Definitions
 * All interfaces and type definitions for the extension
 */

import * as vscode from 'vscode';

// === Q-SEMVER TYPES ===

export interface QSemverInfo {
  sessionId: string;
  chatSessionId: string | null;
  machineId: string;
  workspaceType: 'husk' | 'nucleus' | 'untitled';
  isMultiRoot: boolean;
  chronosQ: number;      // CQ: chronological birth order (1-indexed)
  kairosQ: number | null; // KQ: kairotic role (0.0 = husk, 0.5+ = quest)
  minorVersion: number;  // DEPRECATED: use chronosQ
  patchVersion: number;  // Summarizer-full event count (true reboots). See REBOOT_DEFINITION.md
  qSemver: string;       // "0.X.Y" format (X = chronosQ)
  qSemverKairos: string | null; // "0.X.Y" format (X = kairosQ) if assigned
  roleName: string | null; // Human-readable role (e.g., "husk overseer")
  details: QSemverDetails;
}

export interface QSemverDetails {
  appDataPath: string;
  huskHash: string | null;
  nucleusHash: string | null;
  huskSessionCount: number;
  nucleusSessions: SessionInfo[];
  currentSessionIndex: number;
  workspaceFile: string | null;
  folderUri: string | null;
}

export interface SessionInfo {
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

// === TOOL INPUT TYPES ===

export interface IQSemverParams {
  includeDetails?: boolean;
}

export interface IListSessionsParams {
  workspaceHash?: string;  // Optional: specific hash, otherwise uses current workspace
  includeEmpty?: boolean;  // Include sessions with 0 requests
  fromIndex?: number;      // Starting index for pagination (default 0)
  limit?: number;          // Max sessions to return (default 20, max 100)
}

/**
 * SAFE INTERFACE - With pagination to prevent context death
 * 
 * The old `includeHistory: boolean` alone was a bot-killer:
 * - true = dump ALL messages = 496 messages = context death
 * 
 * New interface adds bounded retrieval:
 * - fromIndex: start position (default 0)
 * - limit: max messages (default 10, max 50)
 * - Always returns pagination metadata when history requested
 */
export interface IGetSessionParams {
  sessionId: string;
  includeHistory?: boolean;  // If true without other params, defaults to fromIndex=0, limit=10
  fromIndex?: number;        // Starting index (use -N for "last N")
  limit?: number;            // Max messages to return (default: 10, max: 50)
}

export interface PaginationInfo {
  totalCount: number;
  returnedCount: number;
  fromIndex: number;
  toIndex: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

export interface ISendMessageParams {
  sessionId: string;
  message: string;
}

export interface IMcpControlParams {
  action: 'list' | 'start' | 'stop' | 'restart' | 'start-all';
  serverName?: string;
}

export interface IMcpOutputParams {
  action: 'list' | 'read' | 'show';
  serverName?: string;
  lines?: number;
}

export interface IAttachFileParams {
  path: string;  // Absolute path to the image file
}

export interface IExecuteCommandParams {
  command: string;  // Command ID like 'workbench.action.reloadWindow'
  args?: unknown[];  // Optional arguments to pass to the command
  fireAndForget?: boolean;  // Don't wait for completion (default: auto-detect for UI commands)
}

export interface IReadOutputParams {
  channelName: string;  // Name of the output channel (e.g., "Qopilot", "Prettier", "GitHub Copilot Chat")
  lines?: number;       // Number of recent lines to return (default: 100)
}

// === Q-SEMVER CONFIGURATION ===

export const Q_CONFIG = {
  HUSK_MINOR: 0,              // Husk sessions get minor=0
  NUCLEUS_MINOR_START: 1,     // Nucleus sessions start at 1
  REQUIRE_REQUESTS: true,     // Only count sessions with messages
};

// === LIMITS (Bot-Killer Prevention) ===

export const SAFETY_LIMITS = {
  GET_SESSION_MAX_MESSAGES: 50,
  GET_SESSION_DEFAULT_MESSAGES: 10,
  LIST_SESSIONS_MAX: 100,
  LIST_SESSIONS_DEFAULT: 20,
  READ_OUTPUT_MAX_LINES: 200,
  READ_OUTPUT_DEFAULT_LINES: 100,
};

// === OUTPUT CHANNEL TYPE ===

export type OutputChannel = vscode.OutputChannel;
