# Qopilot

Utility tools for AI agents in the Q-number system.

## Installation

```bash
cd 00_CC0/04_extensions/qopilot
npm install
npm run compile
npm run package
code-insiders --install-extension qopilot-0.0.1.vsix
```

## Features

### Commands
- **Qopilot: Attach File to Chat** — Attach any file to the current chat context

### MCP Tools (when MCP is available)
- `qopilot_attach_file` — Programmatically attach files
- `qopilot_info` — Get Qopilot status

## For Q-Agents

This extension provides infrastructure for agents in the Q-number system:
- Attach identity files (AGENTS.md) to chat context
- Future: Quest tracking, session identification, sibling discovery

## Development

```bash
npm run watch    # Compile on change
npm run package  # Create .vsix
```

## Version History

- 0.0.1 — Initial release: file attachment
