# US-002: MCP Server Error Log Reading

**Status:** 📋 Proposed  
**Priority:** High  
**Requested By:** victorb (2025-06-15)  

## User Story

**As an** autonomous Copilot agent  
**I want to** read the error output channels of MCP servers  
**So that** I can diagnose and fix MCP server issues without user intervention

## Problem Statement

MCP servers log errors to VS Code's Output panel channels, but agents have no visibility into these logs. When an MCP server fails to start or encounters errors:

1. Agent calls an MCP tool
2. Tool fails with unhelpful generic error
3. Agent cannot see the actual error message in the output channel
4. User must manually check Output panel and relay information

This breaks autonomous debugging and requires human-in-the-loop for MCP troubleshooting.

## Acceptance Criteria

- [ ] Agent can request logs from a specific MCP server's output channel
- [ ] Tool returns recent log entries (configurable line count)
- [ ] Error messages are clearly identifiable
- [ ] Works for both stdio and http MCP server types

## Technical Investigation Required

1. **VS Code Output Channel API**:
   - Can extensions read from output channels they didn't create?
   - Is there an API to enumerate existing output channels?
   - `vscode.window.createOutputChannel()` vs reading existing

2. **MCP Host Output Channels**:
   - How does Copilot's MCP host name its output channels?
   - Pattern: "Copilot MCP - {servername}"?
   - Are logs persisted anywhere accessible?

3. **Log File Locations**:
   - Does Copilot write MCP logs to disk?
   - Extension host logs location
   - Can we read from log files directly?

## Proposed Implementation

### Tool Definition

```json
{
  "name": "qopilot_read_mcp_logs",
  "description": "Read recent logs from an MCP server's output channel",
  "inputSchema": {
    "type": "object",
    "properties": {
      "serverName": {
        "type": "string",
        "description": "Name of the MCP server (from mcp.json)"
      },
      "lines": {
        "type": "number",
        "description": "Number of recent lines to return (default: 50)"
      },
      "filter": {
        "type": "string",
        "enum": ["all", "errors", "warnings"],
        "description": "Filter log entries by severity"
      }
    },
    "required": ["serverName"]
  }
}
```

### Extension Code

```typescript
// Attempt to read from output channel
const channelName = `Copilot MCP - ${serverName}`;
// VS Code doesn't expose reading from output channels directly
// May need alternative approach:
// 1. Intercept logs when qopilot creates/manages MCP servers
// 2. Read from extension log files
// 3. Use debug adapter protocol if available
```

## Challenges

1. **Output Channel Read Access**: VS Code doesn't provide API to read from arbitrary output channels
2. **MCP Host Ownership**: Copilot Chat extension owns the MCP host, not qopilot
3. **Log Persistence**: Logs may only exist in memory, not on disk

## Alternative Approaches

### Option A: MCP Proxy
Qopilot runs its own MCP server that proxies to target servers, capturing all logs.

**Pros:** Full control over logging  
**Cons:** Complex, changes MCP architecture

### Option B: Log File Scraping
Read from VS Code extension host log files in AppData.

**Pros:** No API changes needed  
**Cons:** Unreliable, format not guaranteed

### Option C: Extension Log Aggregator
Qopilot subscribes to all extension output via debug protocol.

**Pros:** Real-time access  
**Cons:** May require debug mode

## Related Work

- [US-003](US-003_MCP_SERVER_CONTROL.md) - MCP server start/stop control
- VS Code API: `vscode.window.createOutputChannel()`
- MCP specification: stdio transport logging

## Notes

This feature is critical for agent autonomy when working with MCP servers. Current workflow requires user to act as "eyes" for the agent, reading error messages and relaying them.
