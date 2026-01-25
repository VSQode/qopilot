/**
 * AppData Path Utilities
 * Helper functions for finding VS Code AppData locations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

/**
 * Get VS Code AppData path for user data
 * Returns path like: C:/Users/victorb/AppData/Roaming/Code - Insiders/User
 */
export function getAppDataPath(): string {
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

/**
 * Get VS Code logs directory
 * Returns path like: C:/Users/victorb/AppData/Roaming/Code - Insiders/logs
 */
export function getLogsPath(): string {
  const appName = vscode.env.appName.includes('Insiders') ? 'Code - Insiders' : 'Code';
  
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', appName, 'logs');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName, 'logs');
    default: // linux
      return path.join(os.homedir(), '.config', appName, 'logs');
  }
}
