# Qopilot

Q-System infrastructure for VS Code agents: Q-semver identity and session discovery tools.

## Packages

| Package | Description |
|---------|-------------|
| [@qopilot/vscode-extension](./packages/vscode-extension) | VS Code extension providing Q-semver identity and session tools |

## What is Q-Semver?

Q-Semver is an identity system for chat agents:

```
CQ: 0.8.22  (Chronos Q - birth order + reboot count)
KQ: 0.0.22  (Kairos Q - role assignment + tenure)
```

- **Chronos Q (CQ)**: `0.{session_birth_order}.{reboot_count}` - When you were born and how many context collapses you've survived
- **Kairos Q (KQ)**: `0.{role}.{tenure}` - What role you play and how long you've held it

## Native Tools

The extension registers Language Model Tools accessible to GitHub Copilot:

- `qopilot_list_sessions` - List all chat sessions in the workspace
- `qopilot_get_session` - Get details about a specific session
- `qopilot_send_message` - File-based inter-session messaging (limited)

## Installation

```bash
cd packages/vscode-extension
npm install
npm run compile
npm run package
code --install-extension qopilot-0.1.0.vsix
```

## License

MIT
