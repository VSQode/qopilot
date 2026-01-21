# US-001: Autonomous Context Refresh Trigger

**Status:** � Research Complete - ❌ NOT FEASIBLE  
**Priority:** High  
**Requested By:** victorb (2025-06-15)  
**Research Completed:** 2025-06-15  
**Related Research:** [2025-06-15_CONTEXT_REFRESH_RESEARCH.md](../../../_/AS/0.0.Q/_/journals/2025-06-15_CONTEXT_REFRESH_RESEARCH.md)

## User Story

**As an** autonomous Copilot agent  
**I want to** trigger a context refresh mid-turn  
**So that** I can pick up new instructions from files I just created/modified (ZORK TORCH pattern)

## Problem Statement

Currently, Copilot's instruction context is calculated once at ChatRequest start and fixed for the duration of the tool-calling loop. When an agent:

1. Creates a sentinel file matching an `applyTo` pattern
2. Calls `qopilot_attach_file` to attach it

The attachment happens AFTER prompt construction, so new instructions won't surface until the NEXT user message.

This breaks the ZORK TORCH pattern where agents pick up "torch" files to gain context-sensitive instructions.

## Acceptance Criteria

- [ ] Agent can call a qopilot tool to trigger context recalculation
- [ ] New instruction files matching `applyTo` patterns surface in the CURRENT turn
- [ ] Works within the same autonomous loop (no user intervention required)

## Technical Investigation ✅ COMPLETED

### Finding 1: No Mid-Turn Refresh API

From `customInstructionsService.ts`, `toolCallingLoop.ts`, and `customInstructions.tsx`:

- Instructions collected once at `Turn.fromRequest()` 
- Stored in `chatVariables` which is fixed for turn duration
- Each `buildPrompt()` iteration reads from SAME chatVariables
- No API to mutate `chatVariables` mid-turn

### Finding 2: Subagent Inherits Parent Context

From `searchSubagentToolCallingLoop.ts`:

```ts
// Creates new Conversation/Turn but passes parent request
return this._run(request, turn, token);
```

The parent `request.references` (chatVariables) are inherited. **Subagents do NOT get fresh instructions.**

### Finding 3: Architecture Limitation

```
ChatRequest → Turn.fromRequest(chatVariables) → ToolCallingLoop
                     ↑                              ↓
                     └── chatVariables FIXED ←──────┘
```

There is no hook to inject new chatVariables during the loop.

### Conclusion: NOT FEASIBLE

Without changes to Copilot Chat core architecture, mid-turn context refresh is impossible. The ZORK TORCH pattern cannot work autonomously - it requires user to send a new message.

## Alternative Approaches

### Option A: Model-Level Injection (WORKAROUND)
Use tool result as carrier for instructions. Model sees updated text in tool output.

```typescript
// qopilot_attach_file returns instructions in result
return {
  content: [{
    type: "text",
    text: `File attached. INSTRUCTIONS FROM FILE:\n${fileContent}`
  }]
};
```

**Pros:** Works now, no API changes needed  
**Cons:** Instructions in tool result, not system prompt; less authoritative

### Option B: Await API Enhancement (LONG-TERM)
Monitor VS Code Chat API proposals for context injection capabilities. File feature request with Microsoft.

### Option C: Two-Turn Pattern (WORKAROUND)
Agent writes file, summarizes what it needs, asks user "send any message to continue with updated context."

**Pros:** Works reliably  
**Cons:** Requires user interaction, breaks autonomy

## Related Codebase References

- `customInstructionsService.ts` - How instructions are collected
- `toolCallingLoop.ts` - Tool calling iteration logic
- `customInstructions.tsx` - PromptElement that renders instructions

## Notes

This is foundational for the ZORK TORCH pattern to work autonomously. Without this, agents cannot pick up context-sensitive instructions mid-turn.
