# Qopilot User Stories

This folder tracks feature requests and enhancement proposals for the Qopilot extension.

## Story Status Legend

- 📋 **Proposed** - Idea captured, needs investigation
- 🔬 **Investigating** - Technical feasibility being researched
- 📐 **Designing** - Solution approach being designed
- 🔨 **In Progress** - Active development
- ✅ **Done** - Implemented and released
- ❌ **Won't Do** - Rejected (with explanation)

## Current Stories

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| [US-001](US-001_CONTEXT_REFRESH_TRIGGER.md) | Autonomous Context Refresh Trigger | � Research Complete | High |
| [US-002](US-002_MCP_LOG_READING.md) | MCP Server Error Log Reading | 📋 Proposed | High |
| [US-003](US-003_MCP_SERVER_CONTROL.md) | MCP Server Start/Stop Control | 🔬 Research Complete ✅ | High |

### Research Summary (2025-06-15)

**US-001 (Context Refresh):** ❌ NOT FEASIBLE with current architecture. Instructions fixed at ChatRequest start.

**US-003 (MCP Control):** ✅ FEASIBLE via VS Code commands:
- `workbench.mcp.startServer` / `stopServer` / `restartServer`
- Requires `mcpServerDefinitions` proposed API for server ID discovery

## Creating New Stories

1. Copy template from `_TEMPLATE.md` (or create new file)
2. Use format: `US-XXX_SHORT_TITLE.md`
3. Fill in all sections
4. Update this README table

## Story Format

Each story should include:
- **Status**: Current state
- **Priority**: High/Medium/Low
- **User Story**: As a... I want... So that...
- **Problem Statement**: What pain point does this solve?
- **Acceptance Criteria**: How do we know it's done?
- **Technical Investigation**: What needs to be researched?
- **Proposed Solutions**: Options considered

## Related Research

Research documents supporting these stories are in:
- [journals/](../../../_/AS/0.0.Q/_/journals/) - Research findings and investigations
- [docs/](../docs/) - Technical documentation

## History

- **2025-06-15**: Initial user story tracking created
  - US-001: Context refresh trigger (ZORK TORCH pattern support)
  - US-002: MCP log reading (agent debugging)
  - US-003: MCP server control (self-healing)
