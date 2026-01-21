# ChatRequest Hooks Research

**Date:** 2025-06-17
**Researcher:** 0.8.15
**Sprint:** L0 Quest - Find ChatRequest creation hook

## Executive Summary

The user's request: *"find the actual hook where a new message is sent to make a ChatRequest and find where the code gets called and design a minimal wrapper around calling that code"*

**Finding:** There are TWO distinct APIs for model interaction in VS Code:

1. **ChatParticipant API** (`vscode.chat.createChatParticipant`) - For building chat UIs
2. **LanguageModel API** (`vscode.lm.selectChatModels` → `sendRequest`) - For direct model access

The ChatParticipant flow (what Copilot uses internally) is NOT exposed for programmatic message injection. However, the LanguageModel API IS available to extensions.

## Architecture Overview

### 1. ChatParticipant Flow (Copilot Chat Extension)

```
User Message → ChatPanel UI → ChatRequest object
                                    ↓
                            Turn.fromRequest(chatVariables)
                                    ↓
                            ToolCallingLoop.run()
                                    ↓ (iterates)
                            buildPrompt() → model.sendRequest()
                            processToolCalls()
                            (repeat until done)
                                    ↓
                            ChatResponse
```

**Key insight:** `chatVariables` (which includes attached files and instructions) is fixed at `Turn.fromRequest()` and never refreshed during the tool-calling loop.

### 2. LanguageModel API (Available to Extensions)

```typescript
// Select a model
const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot' });

// Build messages
const messages = [
  vscode.LanguageModelChatMessage.User('Your prompt here')
];

// Send request
const response = await model.sendRequest(messages, {
  tools: [...], // Optional: available tools
  justification: 'Why access is needed'
});

// Stream response
for await (const chunk of response.stream) {
  if (chunk instanceof vscode.LanguageModelTextPart) {
    console.log(chunk.value);
  } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
    // Handle tool call
  }
}
```

## What IS Possible (Extension API)

### Option 1: Direct Model Access

Extensions can use `vscode.lm.selectChatModels()` to get model access and `sendRequest()` to send prompts directly. This bypasses the ChatParticipant UI entirely.

**Pros:**
- Full control over prompt composition
- Can inject any context we want
- Tool calling supported

**Cons:**
- No chat UI integration
- No conversation history
- Must implement own tool handling

### Option 2: Workbench Commands

VS Code exposes some chat-related commands:

| Command | Purpose |
|---------|---------|
| `workbench.action.chat.open` | Open chat panel |
| `workbench.action.chat.openNewSessionSidebar.{type}` | Open new chat session |
| `workbench.action.chat.attachFile` | Attach file to chat |

**Limitation:** No command to programmatically SEND a message to an existing chat session.

### Option 3: Tool Result Injection (Workaround)

Since tool results appear in the context, we can return instructions in tool output:

```typescript
// In tool implementation
return {
  content: [{
    type: "text",
    text: `File attached successfully.

IMPORTANT INSTRUCTIONS FROM ATTACHED FILE:
${fileContent}
`
  }]
};
```

This gets the model to "see" the content, though not as a system instruction.

## What is NOT Possible (Without Forking)

1. **Mid-turn context refresh** - `chatVariables` is fixed at turn start
2. **Inject message into existing chat** - No public API
3. **Modify system prompt mid-conversation** - Not exposed
4. **Trigger new ChatRequest programmatically** - ChatParticipant handler is internal

## Fork/Patch Options

If "nothing is off the table":

### Option A: Fork github/copilot.vscode

1. Clone the Copilot Chat extension
2. Modify `toolCallingLoop.ts` to refresh `chatVariables` on each iteration
3. Add API to inject new variables mid-turn
4. Build and install forked extension

**Effort:** High
**Maintenance:** Ongoing (must track upstream changes)

### Option B: Extension Interop

1. Create extension that hooks VS Code's extension host messaging
2. Intercept Copilot's internal messages
3. Inject additional context

**Effort:** Very High
**Risk:** Fragile, may break on updates

### Option C: Transport Layer Injection

1. Proxy the HTTP/WebSocket connection to Copilot service
2. Modify requests to include additional context
3. Use mitmproxy or similar

**Effort:** Medium
**Risk:** May violate ToS, breaks on transport changes

## Recommended Approach

For qopilot, the pragmatic path is:

1. **Use LanguageModel API for autonomous tasks** - Create a new chat session that we fully control
2. **Use tool result injection for context updates** - Return important context in tool outputs
3. **Document the limitation** - Context refresh requires new turn
4. **Monitor VS Code proposals** - Watch for `vscode.proposed.chatContextInjection.d.ts` or similar

## Implementation Design: Minimal Context Refresh Wrapper

If we wanted to wrap the ChatRequest creation, we'd need to:

```typescript
// Hypothetical API (not currently exposed)
interface QopilotContextRefresh {
  // Trigger a new ChatRequest with updated context
  refreshContext(options: {
    preserveConversation: boolean;
    newAttachments?: URI[];
    newInstructions?: string[];
  }): Promise<void>;
  
  // Hook into tool calling loop
  onBeforeToolCall(callback: (toolCall: ToolCall) => Promise<void>): Disposable;
  onAfterToolResult(callback: (result: ToolResult) => Promise<void>): Disposable;
}
```

This would require modifying Copilot's `ToolCallingLoop` to:
1. Emit events before/after tool calls
2. Accept dynamic context injection
3. Support mid-loop prompt rebuilding

## Related VS Code Issues to Watch

- microsoft/vscode#xxxxx - Chat context injection API
- github/copilot.vscode#xxxxx - Mid-turn context refresh

## Conclusion

The ChatRequest creation happens inside the Copilot Chat extension's `Turn.fromRequest()` and `ToolCallingLoop`. There is no public hook to intercept or modify this flow without forking.

The **LanguageModel API** (`vscode.lm`) is the legitimate extension point for programmatic model access. For qopilot, we should:

1. ✅ Use `vscode.lm.selectChatModels()` for autonomous model access
2. ✅ Use tool result content for context injection (workaround)
3. ⏳ Watch for proposed APIs that expose context refresh
4. ❓ Consider fork only if user explicitly requests

---

**Next Steps:**
1. Create `qopilot_model_request` tool using LanguageModel API
2. Test tool result injection pattern
3. File feature request on VS Code for context refresh API
