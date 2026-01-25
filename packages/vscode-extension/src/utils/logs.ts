/**
 * Logs Utilities
 * Helper functions for reading VS Code output channel logs
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Find the most recent log session directory
 * VS Code creates session directories with format YYYYMMDDTHHMMSS
 */
export function findLatestLogSession(logsPath: string): string | null {
  if (!fs.existsSync(logsPath)) return null;
  
  const sessions = fs.readdirSync(logsPath)
    .filter(d => /^\d{8}T\d{6}$/.test(d))
    .map(d => path.join(logsPath, d));
  
  // Find the session with the most recently modified output_logging directory
  let latestSession: string | null = null;
  let latestMtime = 0;
  
  for (const sessionPath of sessions) {
    // Check all window/exthost/output_logging_* directories
    try {
      const windowDirs = fs.readdirSync(sessionPath)
        .filter(d => d.startsWith('window'))
        .map(d => path.join(sessionPath, d));
      
      for (const windowDir of windowDirs) {
        const exthostDir = path.join(windowDir, 'exthost');
        if (!fs.existsSync(exthostDir)) continue;
        
        const outputDirs = fs.readdirSync(exthostDir)
          .filter(d => d.startsWith('output_logging_'))
          .map(d => path.join(exthostDir, d));
        
        for (const outputDir of outputDirs) {
          try {
            const stats = fs.statSync(outputDir);
            if (stats.mtimeMs > latestMtime) {
              latestMtime = stats.mtimeMs;
              latestSession = sessionPath;
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  
  // Fallback to newest by name if no output dirs found
  if (!latestSession && sessions.length > 0) {
    sessions.sort().reverse();
    latestSession = sessions[0];
  }
  
  return latestSession;
}

/**
 * Find output channel log file by name
 * Searches ALL session directories and ALL windows, returns the most recently modified match
 */
export function findOutputChannelLog(logsPath: string, channelName: string): { path: string; content: string; sessionPath: string } | null {
  if (!fs.existsSync(logsPath)) return null;
  
  const candidates: { path: string; mtime: number; sessionPath: string }[] = [];
  
  // Get all session directories
  const sessions = fs.readdirSync(logsPath)
    .filter(d => /^\d{8}T\d{6}$/.test(d))
    .map(d => path.join(logsPath, d));
  
  for (const sessionPath of sessions) {
    try {
      // Search through window directories
      const windowDirs = fs.readdirSync(sessionPath)
        .filter(d => d.startsWith('window'))
        .map(d => path.join(sessionPath, d));
      
      for (const windowDir of windowDirs) {
        const exthostDir = path.join(windowDir, 'exthost');
        if (!fs.existsSync(exthostDir)) continue;
        
        // Find ALL output_logging directories
        try {
          const outputDirs = fs.readdirSync(exthostDir)
            .filter(d => d.startsWith('output_logging_'))
            .map(d => path.join(exthostDir, d));
          
          for (const outputDir of outputDirs) {
            try {
              const files = fs.readdirSync(outputDir);
              const matchingFile = files.find(f => 
                f.toLowerCase().includes(channelName.toLowerCase()) && f.endsWith('.log')
              );
              
              if (matchingFile) {
                const filePath = path.join(outputDir, matchingFile);
                const stats = fs.statSync(filePath);
                candidates.push({ path: filePath, mtime: stats.mtimeMs, sessionPath });
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        
        // Also check MCP server logs at window level
        try {
          const files = fs.readdirSync(windowDir);
          const mcpFile = files.find(f => 
            f.toLowerCase().includes(channelName.toLowerCase()) && f.endsWith('.log')
          );
          
          if (mcpFile) {
            const filePath = path.join(windowDir, mcpFile);
            const stats = fs.statSync(filePath);
            candidates.push({ path: filePath, mtime: stats.mtimeMs, sessionPath });
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
  
  // Return the most recently modified match
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.mtime - a.mtime);
  const best = candidates[0];
  const content = fs.readFileSync(best.path, 'utf-8');
  return { path: best.path, content, sessionPath: best.sessionPath };
}

/**
 * List all available output channels from ALL sessions
 */
export function listAllOutputChannels(logsPath: string): string[] {
  const channels = new Set<string>();
  
  if (!fs.existsSync(logsPath)) return [];
  
  const sessions = fs.readdirSync(logsPath)
    .filter(d => /^\d{8}T\d{6}$/.test(d))
    .map(d => path.join(logsPath, d));
  
  for (const sessionPath of sessions) {
    try {
      const windowDirs = fs.readdirSync(sessionPath)
        .filter(d => d.startsWith('window'))
        .map(d => path.join(sessionPath, d));
      
      for (const windowDir of windowDirs) {
        // MCP server logs at window level
        try {
          const windowFiles = fs.readdirSync(windowDir);
          for (const f of windowFiles) {
            if (f.startsWith('mcpServer.') && f.endsWith('.log')) {
              channels.add(f.replace('mcpServer.', '').replace('.log', ''));
            }
          }
        } catch { /* ignore */ }
        
        // Output channel logs in exthost
        const exthostDir = path.join(windowDir, 'exthost');
        if (!fs.existsSync(exthostDir)) continue;
        
        try {
          const outputDirs = fs.readdirSync(exthostDir)
            .filter(d => d.startsWith('output_logging_'))
            .map(d => path.join(exthostDir, d));
          
          for (const outputDir of outputDirs) {
            try {
              const files = fs.readdirSync(outputDir);
              for (const f of files) {
                if (f.endsWith('.log')) {
                  const match = f.match(/^\d+-(.+)\.log$/);
                  if (match) {
                    channels.add(match[1]);
                  }
                }
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
  
  return [...channels].sort();
}
