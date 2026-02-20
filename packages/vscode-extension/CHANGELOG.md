# Changelog

All notable changes to the Qopilot extension will be documented in this file.

## [0.3.0] - 2026-02-19

### Fixed

#### JSONL format support (VS Code 1.109+ compatibility)
- **`parseSessionFile()`** — unified parser handling both `.json` (monolithic) and `.jsonl` (snapshot+patches)
- JSONL: `kind=0` line is the full snapshot; `kind=1` lines are patches applied via key-path walk
- Key-path types correctly typed as `(string | number)[]` — array indices are integers, not strings
- **Sparse array guard** — JSONL patch walk can create sparse request arrays; `if (!req) continue` added in all iteration loops
- **Pre-June 2025 legacy format** — `progressTask` kind now counted in addition to `progressTaskSerialized` (resolves THESEUS Prime era reboot under-count)

#### `readSessions()` improvements
- Accepts both `.json` and `.jsonl` extensions
- Deduplication: `.jsonl` takes precedence over `.json` for the same session ID
- `firstMessageTime` now uses `Array.find` to skip sparse slots

#### `qopilot_get_session`
- Tries `.jsonl` before `.json` when locating a session by ID
- Uses `parseSessionFile` for both formats

### Added

#### `qopilot_get_qsemver` — minimal mode
- New `minimal: boolean` parameter
- When `true`, returns only `{ chatSessionId, rebootCount, qSemver }` (~30 tokens)
- Designed for agent wake-up without spending context budget

## [0.2.0] - 2026-01-25

### ⚠️ BREAKING CHANGES

**Bot-Killer Prevention:** All tools that return collections now have bounded pagination by default.

### Changed

#### `qopilot_get_session`
- **Added `fromIndex` parameter** - Starting message index (default: 0)
- **Added `limit` parameter** - Max messages to return (default: 10, max: 50)
- **Negative fromIndex support** - Use `-5` to get "last 5 messages"
- **Returns `PaginationInfo`** - Shows `totalCount`, `hasMore`, `hasPrevious`
- **Returns `navigation` hints** - `nextPage`, `prevPage` query strings

⚠️ **Old behavior:** `includeHistory=true` dumped ALL messages (killed agent context)  
✅ **New behavior:** `includeHistory=true` returns first 10 messages by default

#### `qopilot_list_sessions`
- **Added `fromIndex` parameter** - Starting session index (default: 0)
- **Added `limit` parameter** - Max sessions to return (default: 20, max: 100)
- **Returns `PaginationInfo`** - Shows `totalCount`, `hasMore`, `hasPrevious`
- **Returns `navigation` hints** - `nextPage`, `prevPage` query strings

### Added

- `SAFETY_LIMITS` constants in types/index.ts to centralize limits
- `PaginationInfo` interface for consistent pagination metadata

### Fixed

- Agent context death from unbounded returns (documented in ERRATA.md as SENSORIUM-004)

### Security

- Tools can no longer be used to dump entire session histories
- Maximum return limits are enforced even if agent requests more

---

## [0.1.0] - 2026-01-20

### Added

- Initial release with 9 LLM tools:
  - `qopilot_get_qsemver` - Q-Semver identity
  - `qopilot_list_sessions` - List chat sessions
  - `qopilot_get_session` - Get session details
  - `qopilot_send_message` - Inter-session messaging (file-based)
  - `qopilot_mcp_control` - MCP server lifecycle
  - `qopilot_mcp_output` - MCP server logs
  - `qopilot_attach_file` - Attach images to vision
  - `qopilot_execute_command` - Execute VS Code commands
  - `qopilot_read_output` - Read output channels

---

**Fixed by:** ALTAIR 0.0.Q (patch 53)  
**Reason:** Agent called `qopilot_get_session(includeHistory=true)` which returned 496 messages and killed context. This is the same death pattern as `github_repo`.
