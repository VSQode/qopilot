# US-003: MCP Server Start/Stop Control

**Status:** � Research Complete  
**Priority:** High  
**Requested By:** victorb (2025-06-15)  
**Research Completed:** 2025-06-15  

## User Story

**As an** autonomous Copilot agent  
**I want to** start, stop, and restart MCP servers  
**So that** I can recover from errors, apply configuration changes, and manage server lifecycle

## Problem Statement

When MCP servers encounter issues (native module mismatch, dependency errors, config changes), the only recovery path is:

1. User manually restarts VS Code (nuclear option)
2. User uses "Developer: Reload Window" (still disruptive)
3. User runs "GitHub Copilot: Restart MCP Servers" command (requires user action)

Agents cannot autonomously recover from MCP issues or apply changes that require server restart.

## Acceptance Criteria

- [ ] Agent can start a specific MCP server by name
- [ ] Agent can stop a specific MCP server by name
- [ ] Agent can restart a specific MCP server by name
- [ ] Agent can restart ALL MCP servers (equivalent to command)
- [ ] Agent receives confirmation of action success/failure
- [ ] Works without user intervention or window reload

## Technical Investigation ✅ COMPLETED

### VS Code MCP Command IDs (from [mcpCommandIds.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/common/mcpCommandIds.ts))

```typescript
// Individual server control (takes serverId as argument)
StartServer = 'workbench.mcp.startServer'
StopServer = 'workbench.mcp.stopServer' 
RestartServer = 'workbench.mcp.restartServer'
ShowOutput = 'workbench.mcp.showOutput'

// Other useful commands
ListServer = 'workbench.mcp.listServer'
ServerOptions = 'workbench.mcp.serverOptions'
ShowConfiguration = 'workbench.mcp.showConfiguration'
```

### Command Signatures (from [mcpCommands.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/browser/mcpCommands.ts))

```typescript
// StartServer - accepts serverId and optional opts
async run(accessor: ServicesAccessor, serverId: string, opts?: IMcpServerStartOpts & { waitForLiveTools?: boolean })
// Special: serverId === '*' starts ALL servers

// StopServer - just serverId
async run(accessor: ServicesAccessor, serverId: string)

// RestartServer - serverId and optional opts
async run(accessor: ServicesAccessor, serverId: string, opts?: IMcpServerStartOpts)
```

### Key Finding: serverId Format
The `serverId` is `server.definition.id` from the `IMcpServer` object. Need to determine:
1. How server IDs are constructed from mcp.json server names
2. Whether extensions can discover available server IDs

### API for Discovering Servers

```typescript
// Proposed extension API (from vscode.proposed.mcpServerDefinitions.d.ts)
namespace vscode.lm {
  export const mcpServerDefinitions: readonly McpServerDefinition[];
  export const onDidChangeMcpServerDefinitions: Event<void>;
}
```

This API allows extensions to enumerate MCP server definitions and their IDs!

## Proposed Implementation

### Tool Definitions

```json
{
  "name": "qopilot_mcp_control",
  "description": "Control MCP server lifecycle (start/stop/restart)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["start", "stop", "restart", "start-all", "list"],
        "description": "Action to perform"
      },
      "serverName": {
        "type": "string",
        "description": "Name of the MCP server (from mcp.json). Required except for start-all and list."
      }
    },
    "required": ["action"]
  }
}
```

### Extension Code

```typescript
import * as vscode from 'vscode';

interface MCPControlResult {
  success: boolean;
  message: string;
  servers?: string[];
}

async function mcpControl(action: string, serverName?: string): Promise<MCPControlResult> {
  // Note: This requires enabledApiProposals: ["mcpServerDefinitions"]
  const definitions = vscode.lm.mcpServerDefinitions;
  
  switch (action) {
    case 'list':
      return {
        success: true,
        message: `Found ${definitions.length} MCP servers`,
        servers: definitions.map(d => d.label)
      };
    
    case 'start-all':
      await vscode.commands.executeCommand('workbench.mcp.startServer', '*');
      return { success: true, message: 'All MCP servers started' };
    
    case 'start':
    case 'stop':
    case 'restart':
      if (!serverName) {
        return { success: false, message: 'serverName required for this action' };
      }
      
      // Find server ID from name
      const server = definitions.find(d => d.label === serverName);
      if (!server) {
        return { 
          success: false, 
          message: `Server "${serverName}" not found`,
          servers: definitions.map(d => d.label)
        };
      }
      
      const commandMap = {
        'start': 'workbench.mcp.startServer',
        'stop': 'workbench.mcp.stopServer',
        'restart': 'workbench.mcp.restartServer'
      };
      
      await vscode.commands.executeCommand(commandMap[action], server.id);
      return { success: true, message: `Server "${serverName}" ${action}ed` };
  }
  
  return { success: false, message: `Unknown action: ${action}` };
}
```

### Package.json Requirements

```json
{
  "enabledApiProposals": ["mcpServerDefinitions"]
}
```

## Challenges

1. **Proposed API**: `mcpServerDefinitions` is a proposed API requiring `enabledApiProposals`
2. **Server ID Discovery**: Need to verify server ID format matches what commands expect
3. **Insiders Only**: Proposed APIs may only work in VS Code Insiders

## Implementation Status: ✅ FEASIBLE

**Finding:** Full individual server control IS possible via VS Code commands:

| Action | Command | Arguments |
|--------|---------|-----------|
| Start one | `workbench.mcp.startServer` | `serverId`, `opts?` |
| Start all | `workbench.mcp.startServer` | `'*'` |
| Stop one | `workbench.mcp.stopServer` | `serverId` |
| Restart one | `workbench.mcp.restartServer` | `serverId`, `opts?` |
| Show output | `workbench.mcp.showOutput` | `serverId` |
| List servers | `workbench.mcp.listServer` | (opens picker) |

**Key Requirement:** Extension needs `mcpServerDefinitions` proposed API to discover server IDs.

## Alternative Approaches

### Option A: Command Execution
Execute `github.copilot.restartMcpServers` command if it exists.

**Pros:** Simple, uses existing infrastructure  
**Cons:** All-or-nothing restart, no individual control

### Option B: MCP.json Manipulation
Modify mcp.json to disable/enable servers, triggering Copilot to reload.

**Pros:** Works within file-based config  
**Cons:** Hacky, may cause issues

### Option C: Qopilot-Managed MCP
Qopilot manages its own MCP servers separately from Copilot's.

**Pros:** Full control  
**Cons:** Duplicate infrastructure, user confusion

## Related Work

- [US-002](US-002_MCP_LOG_READING.md) - MCP error log reading
- `.vscode/mcp.json` - MCP server configuration
- Copilot Chat extension MCP host implementation

## Current Workaround

Script in agent's folder outputs warning after native module rebuild:

```
⚠️  MCP server restart required (NOT VS Code restart)
    Run: "GitHub Copilot: Restart MCP Servers" from Command Palette
```

But agent cannot execute this command autonomously.

## Priority Justification

This feature directly enables:
1. Self-healing after MCP errors
2. Hot-reloading config changes
3. Recovering from native module version mismatches
4. Reducing human intervention in agent workflows

Combined with US-002 (log reading), enables fully autonomous MCP troubleshooting.
