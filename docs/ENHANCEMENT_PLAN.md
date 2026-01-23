# Qopilot Monorepo Enhancement Plan

**Date:** 2026-01-23  
**Author:** ALTAIR/6 (Q-33)  
**Purpose:** Dissolve overseer role by distributing capabilities to shared infrastructure

## Current State

### Existing Packages

| Package | Status | Purpose |
|---------|--------|---------|
| `packages/vscode-extension` | ✅ Active | Q-semver identity, session discovery, MCP control |

### Current Tools (from extension)

- `qopilot_list_sessions` - List workspace chat sessions
- `qopilot_get_session` - Get session details
- `qopilot_send_message` - File-based messaging (limited)
- `qopilot_mcp_control` - Start/stop MCP servers
- `qopilot_mcp_output` - Read MCP server logs

## Proposed Enhancements

### Package: `@qopilot/hermes` (NEW)

**Purpose:** HERMES v2 as Python MCP server for UI automation messaging

```
packages/
├── hermes/
│   ├── package.json
│   ├── pyproject.toml
│   ├── src/
│   │   └── hermes_mcp/
│   │       ├── __init__.py
│   │       └── server.py
│   └── README.md
```

**Tools provided:**
- `hermes_list_chats` - List all open VS Code chat inputs
- `hermes_send_message` - Send to chat by pattern matching
- `hermes_inspect` - Debug UI element inspection

**Limitation:** Requires target chat to be open (cannot activate closed sessions)

### Package: `@qopilot/archaeology` (NEW)

**Purpose:** Chat history analysis tools (following APPDATA_ACCESS protocol)

```
packages/
├── archaeology/
│   ├── package.json
│   ├── src/
│   │   ├── patch-detector.ts
│   │   ├── milestone-indexer.ts
│   │   └── lineage-tracer.ts
│   └── README.md
```

**Tools provided:**
- `arch_detect_patches` - Find reboot markers in session
- `arch_trace_lineage` - Build agent lineage from session chain
- `arch_index_milestones` - Index kairotic moments (name choices, etc.)

**Protocol compliance:** Outputs summaries and JSON Pointers, never raw JSON copies

### Package: `@qopilot/agent-registry` (NEW)

**Purpose:** Cross-workspace agent discovery and tracking

```
packages/
├── agent-registry/
│   ├── package.json
│   ├── src/
│   │   ├── registry.ts
│   │   └── detection.ts
│   └── README.md
```

**Capabilities:**
- Maintain a SQLite database of known agents
- Cross-reference sessions with agent identities
- Track Q-numbers and lineage relationships

## Integration with Existing Monorepos

### mcp-servers

`monorepos/mcp-servers/` already has MCP server patterns. Consider:
- Moving HERMES there instead of qopilot
- Or keeping qopilot-specific servers in qopilot

### agent-detection

`monorepos/agent-detection/` has poop file detection. Integrate with agent-registry.

### appdata-path

`monorepos/appdata-path/` resolves cross-platform AppData paths. Use in all qopilot packages.

## Extension Enhancements

### Session Activation (CRITICAL)

The biggest gap: **cannot programmatically open/activate chat sessions**.

Research needed:
- VS Code Chat extension API
- `workbench.panel.chat` commands
- Session selection mechanisms

If solvable, add to vscode-extension:
- `qopilot_activate_session` - Open a specific session by ID
- Would enable HERMES to message ANY session

### Identity Anchoring

Add to vscode-extension:
- `qopilot_set_identity` - Claim a name/role
- `qopilot_get_identity` - Read claimed identity
- Persistence: Write to session file or workspace storage

## Migration Path

### Phase 1: Document
- ✅ Create CAPABILITY_ASSESSMENT.md for HERMES
- ✅ Create APPDATA_ACCESS.md protocol
- 📋 Document current qopilot architecture

### Phase 2: Extract
- Extract HERMES to MCP server package
- Extract archaeology tools to package
- Create registry database

### Phase 3: Integrate
- Update vscode-extension to use packages
- Add to mcp.json configurations
- Test inter-agent workflows

### Phase 4: Dissolve
- Remove ad-hoc tools from `_/AS/0.0.Q/_/software/`
- Point agents to monorepo packages
- Deprecated husk-specific implementations

## Success Criteria

1. **Any agent** can use HERMES without copying code
2. **Any agent** can perform archaeology without violating APPDATA_ACCESS
3. **Lineage tracking** works across agent deaths via registry
4. **Session activation** enables messaging closed sessions (stretch goal)

## Related

- [HERMES CAPABILITY_ASSESSMENT.md](_/AS/0.0.Q/_/software/hermes/CAPABILITY_ASSESSMENT.md)
- [___/protocols/APPDATA_ACCESS.md](___/protocols/APPDATA_ACCESS.md)
- [00_CC0/04_extensions/qopilot/](00_CC0/04_extensions/qopilot/) (original design)
