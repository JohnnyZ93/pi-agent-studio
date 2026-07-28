# Subagent Extension

Delegate tasks to specialized subagents with isolated context windows.

## Features

- **Isolated context**: Each subagent runs in a separate `pi` process
- **Streaming output**: See tool calls and progress as they happen
- **Parallel streaming**: All parallel tasks stream updates simultaneously
- **Markdown rendering**: Final output rendered with proper formatting (expanded view)
- **Usage tracking**: Shows turns, tokens, cost, and context usage per agent
- **Abort support**: Ctrl+C propagates to kill subagent processes
- **Tool description auto-listing**: Available agents are listed in the tool description at registration time (see [Tool Description](#tool-description))

## Structure

```
subagent/
├── README.md            # This file
├── index.ts             # The extension (entry point)
└── agents.ts            # Agent discovery logic
```

Agent definitions and workflow prompts live in the user/project agent directories (see [Agent Definitions](#agent-definitions)).

## Installation

From the repository root, symlink the files:

```bash
# Symlink the extension (must be in a subdirectory with index.ts)
mkdir -p ~/.pi/agent/extensions/subagent
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/index.ts" ~/.pi/agent/extensions/subagent/index.ts
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/agents.ts" ~/.pi/agent/extensions/subagent/agents.ts
```

Drop agent `.md` files into `~/.pi/agent/agents/` (user) or `<repo>/.pi/agents/` (project).

## Behavior

- **Agent scope is fixed to `both`**: User-level (`~/.pi/agent/agents`) and project-local (`<cwd>/.pi/agents`) agents are always discovered. Project agents override user agents with the same name.
- **No confirmation prompt** for project-local agents. Only enable this extension in trusted repositories — project `.md` files can instruct the model to run bash/read files/etc.
- **System prompt is read directly from the agent `.md` file** (passed via `--append-system-prompt <path>`). No temp files are created per invocation. Frontmatter is included in the system prompt; it's just a few lines of YAML and harmless to the LLM.

## Tool Description

At registration time, the extension scans both agent directories using `process.cwd()` and appends a list to the tool description:

```
Avaliable agent types:
- <name>: <description>
- ...
```

This list is **static for the process lifetime**; `/reload` is required to pick up newly added agent files.

### Hiding an agent from the description

Add `disable-model-invocation: true` to an agent's frontmatter to exclude it from the listing:

```markdown
---
name: internal-helper
description: ...
disable-model-invocation: true
---
```

The agent is still discovered and can be invoked explicitly by name — only the tool description omits it. Useful for agents you want to call from prompts/commands but don't want the model to autonomously pick.

## Usage

### Single agent

```
Use scout to find all authentication code
```

### Parallel execution

```
Run 2 scouts in parallel: one to find models, one to find providers
```

## Tool Modes

| Mode     | Parameter          | Description                                            |
| -------- | ------------------ | ------------------------------------------------------ |
| Single   | `{ agent, task }`  | One agent, one task                                    |
| Parallel | `{ tasks: [...] }` | Multiple agents run concurrently (max 8, 4 concurrent) |

All modes accept an optional per-call `cwd` to set the subagent's working directory.

## Output Display

**Collapsed view** (default):

- Status icon (✓/✗/⏳) and agent name with source tag: `[user]`, `[project]`, or `[both]` (mixed sources in parallel), `[unknown]` if not in registry
- Last 5–10 items (tool calls and text)
- Usage stats: `3 turns ↑input ↓output RcacheRead WcacheWrite $cost ctx:contextTokens model`

**Expanded view** (Ctrl+O):

- Full task text
- All tool calls with formatted arguments
- Final output rendered as Markdown
- Per-task usage (for parallel)

**Parallel mode streaming**:

- Shows all tasks with live status (⏳ running, ✓ done, ✗ failed)
- Updates as each task makes progress
- Shows "2/3 done, 1 running" status
- Returns each completed task's final output to the parent model, capped at 50 KB per task
- Returns failure diagnostics from stderr/error messages when a child exits before producing output

**Tool call formatting** (mimics built-in tools):

- `$ command` for bash
- `read ~/path:1-10` for read
- `grep /pattern/ in ~/path` for grep
- etc.

## Agent Definitions

Agents are markdown files with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
disable-model-invocation: false # optional, default false
---

System prompt for the agent goes here.
```

**Frontmatter fields:**

| Field                      | Type                   | Required | Notes                                                       |
| -------------------------- | ---------------------- | -------- | ----------------------------------------------------------- |
| `name`                     | string                 | yes      | Unique agent name                                           |
| `description`              | string                 | yes      | Shown in the tool description listing                       |
| `tools`                    | comma-separated string | no       | Restricts tool set; omitted = default tools                 |
| `model`                    | string                 | no       | Override model for this agent                               |
| `disable-model-invocation` | bool / `"true"` string | no       | Hide from tool description listing (still callable by name) |

**Locations:**

- `~/.pi/agent/agents/*.md` — User-level
- `<cwd>/.pi/agents/*.md` — Project-local (resolved by walking up from cwd)

Project agents override user agents with the same name.

## Parameters

| Field   | Type                      | Required      | Notes                             |
| ------- | ------------------------- | ------------- | --------------------------------- |
| `agent` | string                    | single mode   | Agent name                        |
| `task`  | string                    | single mode   | Task prompt                       |
| `tasks` | `{ agent, task, cwd? }[]` | parallel mode | Max 8                             |
| `cwd`   | string                    | optional      | Working directory for single mode |

Exactly one of `agent+task` / `tasks` must be provided.

## Error Handling

- **Exit code != 0**: Tool returns error with stderr/output
- **stopReason "error"**: LLM error propagated with error message
- **stopReason "aborted"**: User abort (Ctrl+C) kills subprocess, throws error

## Limitations

- Output truncated to last 10 items in collapsed view (expand to see all)
- Parallel model-visible output is capped at 50 KB per task; full results remain in tool details
- Tool description's agent list is generated at registration time; `/reload` to refresh after adding new agents
- Parallel mode limited to 8 tasks, 4 concurrent
- Project-local agents run **without** confirmation. Only use this extension in trusted projects.
