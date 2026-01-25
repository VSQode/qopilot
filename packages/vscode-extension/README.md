# Qopilot v0.2.0

Q-System infrastructure: Q-semver identity and session discovery tools for AI agents.

## Installation

```bash
cd monorepos/qopilot/packages/vscode-extension
npm install
npm run deploy  # Compiles, packages, and installs
```

Or manually:
```bash
npm run compile
npm run package
code-insiders --install-extension qopilot.vsix --force
```

## LLM Tools

### Identity & Sessions
| Tool | Description |
|------|-------------|
| `qopilot_get_qsemver` | Get your Q-Semver identity (CQ birth order + KQ role) |
| `qopilot_list_sessions` | List chat sessions with pagination (default 20, max 100) |
| `qopilot_get_session` | Get session details with message history (default 10, max 50) |
| `qopilot_send_message` | Inter-session messaging (file-based inbox) |

### MCP Server Control
| Tool | Description |
|------|-------------|
| `qopilot_mcp_control` | Start, stop, restart MCP servers |
| `qopilot_mcp_output` | Read MCP server logs |

### Utilities
| Tool | Description |
|------|-------------|
| `qopilot_attach_file` | Attach images for vision context |
| `qopilot_execute_command` | Execute VS Code commands |
| `qopilot_read_output` | Read output channels |

## Safe API Design (v0.2.0)

All tools that return collections have **bounded pagination**:

```javascript
// GOOD: Get last 5 messages
qopilot_get_session({ sessionId: "...", includeHistory: true, fromIndex: -5, limit: 5 })

// GOOD: Paginate through sessions
qopilot_list_sessions({ fromIndex: 0, limit: 10 })  // First page
qopilot_list_sessions({ fromIndex: 10, limit: 10 }) // Second page

// SAFE: Defaults to 10 messages (won't kill context)
qopilot_get_session({ sessionId: "...", includeHistory: true })
```

### Safety Limits
| Tool | Default | Max |
|------|---------|-----|
| `qopilot_get_session` | 10 messages | 50 |
| `qopilot_list_sessions` | 20 sessions | 100 |
| `qopilot_read_output` | 100 lines | 200 |
| `qopilot_mcp_output` | 50 lines | — |

## Commands

- **Qopilot: Show Q-Semver Identity** — Display your Q-identity
- **Qopilot: Attach File to Chat** — Attach file to chat context
- **Qopilot: Show Logs** — Open Qopilot output channel

## Development

```bash
npm run watch    # Compile on change
npm run package  # Create .vsix
npm run deploy   # Full build + install
```

See [CHANGELOG.md](CHANGELOG.md) for version history.
