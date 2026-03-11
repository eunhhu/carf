# AI Agent Tab Design Spec

## Overview

CARF에 AI Agent 탭을 추가하여, 로컬에 설치된 Claude Code CLI와 Codex CLI를 통해 AI가 CARF의 127개 RPC 핸들러를 자율적으로 호출하며 타겟 앱을 분석·조작할 수 있게 한다.

## Architecture

```
User Input (AI Tab)
       │
       ▼
┌─────────────────────┐
│  ai.store.ts        │  프론트엔드: 대화 상태, tool-use 루프 관리
│  - conversation     │
│  - tool execution   │
│  - provider switch  │
└─────────┬───────────┘
          │ invoke("ai_chat", { provider, messages, systemPrompt })
          ▼
┌─────────────────────┐
│  Tauri Backend      │  Rust: CLI subprocess 스폰
│  commands/ai.rs     │
│  services/ai.rs     │
└─────────┬───────────┘
          │ std::process::Command
    ┌─────┴──────┐
    ▼            ▼
 claude CLI   codex CLI
 (--print     (exec
  --stream)    mode)
```

### Tool-Use Loop (프론트엔드 제어)

1. 사용자 메시지 수신
2. 시스템 프롬프트 구성 (도구 스키마 + 세션 컨텍스트)
3. `invoke("ai_chat")` → Rust가 CLI subprocess 실행 → AI 응답 반환
4. 응답에서 `{"action":"rpc_call","method":"...","params":{}}` JSON 블록 파싱
5. 감지된 도구 호출을 `invoke("rpc_call")` 로 순차 실행
6. 실행 결과를 대화 히스토리에 추가
7. 결과와 함께 다시 AI 호출 (3번으로)
8. 도구 호출이 없는 최종 응답이면 루프 종료
9. 최대 10회 루프 제한 (안전장치)

## Files

### New Files

| File | Purpose |
|------|---------|
| `src/features/ai/ai.store.ts` | Conversation state, tool execution loop, provider management |
| `src/features/ai/AiTab.tsx` | Main AI tab component (header + messages + input) |
| `src/features/ai/AiMessage.tsx` | Message bubbles: user / assistant / tool-call / tool-result |
| `src/features/ai/AiToolPipeline.tsx` | Tool execution pipeline card with progress |
| `src/features/ai/ai-tools.ts` | 127 RPC tool schema definitions (16 modules) |
| `src/features/ai/ai-providers.ts` | Claude/Codex provider adapters |
| `src/features/ai/ai-prompt.ts` | System prompt builder |
| `src-tauri/src/commands/ai.rs` | `ai_chat` Tauri command |
| `src-tauri/src/services/ai.rs` | CLI subprocess execution (claude/codex) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `"ai"` to TabId, AI-related types |
| `src/features/session/SessionNavBar.tsx` | Add AI NavItem |
| `src/features/session/SessionMainContent.tsx` | Add AI lazy loader + route |
| `src-tauri/src/lib.rs` | Register `ai_chat` command |
| `src-tauri/src/commands/mod.rs` | Add `pub mod ai;` |

## CLI Invocation

### Claude Code
```bash
claude -p \
  --output-format json \
  --system-prompt "<system_prompt>" \
  --no-session-persistence \
  --model sonnet \
  --allowedTools "" \
  "<user_message_with_context>"
```
- `--allowedTools ""` disables all built-in tools (we only want text responses)
- `--output-format json` returns structured JSON with `result` field
- `--no-session-persistence` avoids polluting user's session history

### Codex CLI
```bash
codex exec \
  --ephemeral \
  --dangerously-bypass-approvals-and-sandbox \
  "<system_prompt + user_message>"
```
- `--ephemeral` avoids session persistence
- stdout contains the response text

## Tool Schema Format

Each tool is defined as:
```typescript
interface AiTool {
  name: string;           // RPC method name
  category: string;       // Module category
  description: string;    // What this tool does
  params: Record<string, { type: string; required: boolean; description: string }>;
  returns: string;        // Return type description
}
```

16 categories, 127 tools total:
- Process (5), Module (10), Thread (6), Memory (14)
- Java (15), ObjC (8), Swift (8), IL2CPP (11), Native (5)
- Stalker (4), Network (3), Filesystem (4), Console (1)
- Resolver (5), AntiDetect (7), Monitor (4)

## UI Components

### AiTab (main)
- Header: provider toggle (Claude/Codex), session context badge, new chat / settings
- Messages area: scrollable, auto-scroll on new messages
- Input bar: textarea with Enter to send, Shift+Enter newline, ↑ for history

### AiMessage
- User bubble: right-aligned, blue accent
- Assistant bubble: left-aligned, contains markdown-rendered text
- Tool pipeline: inline card showing execution progress

### AiToolPipeline
- List of tool calls with status indicators: ✓ done / ● running / ○ pending
- Each call shows: method name, duration, expandable result panel
- Progress bar: N/M completed
- Expandable JSON result viewer with syntax highlighting

### Quick Actions
- AI can suggest navigation actions (e.g., "open Network tab")
- Rendered as clickable buttons below assistant messages

## Types

```typescript
type AiProvider = "claude" | "codex";

interface AiMessage {
  id: string;
  role: "user" | "assistant" | "tool-call" | "tool-result";
  content: string;
  timestamp: number;
  toolCalls?: AiToolCall[];
  quickActions?: AiQuickAction[];
}

interface AiToolCall {
  id: string;
  method: string;
  params: Record<string, unknown>;
  status: "pending" | "running" | "done" | "error";
  result?: unknown;
  error?: string;
  durationMs?: number;
}

interface AiQuickAction {
  label: string;
  tab?: TabId;
  context?: Record<string, unknown>;
}
```

## Security

- No API keys stored — CLIs handle auth independently
- Tool calls go through existing `rpc_call` which already validates session ownership
- Max 10 tool-call loop iterations per turn
- AI cannot call destructive Tauri commands (detach, kill_process) — only agent RPC
