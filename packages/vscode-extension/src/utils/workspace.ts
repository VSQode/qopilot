/**
 * Workspace Utilities
 * Helper functions for workspace URI and hash discovery
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get workspace URI for hash computation
 * Returns the workspace file URI (nucleus) or folder URI (husk)
 */
export function getWorkspaceUri(): { uri: string; type: 'husk' | 'nucleus' | 'untitled' } {
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

/**
 * Find workspace hash by searching workspace.json files
 * VS Code stores workspace hashes in workspaceStorage/{hash}/workspace.json
 */
export function findWorkspaceHash(appDataPath: string, targetPath: string, type: 'husk' | 'nucleus'): string | null {
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
