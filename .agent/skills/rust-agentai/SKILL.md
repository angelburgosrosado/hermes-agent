---
name: rust-agentai
description: Build AI agents in Rust using the agentai crate. Use this skill whenever the user wants to create a Rust AI agent, implement a tool-using agent in Rust, use structured output from an LLM in Rust, integrate MCP servers into a Rust agent, or work with the agentai or genai crates. Trigger on phrases like "Rust agent", "build an agent in Rust", "agentai crate", "structured output in Rust", "MCP in Rust", or any request to build an LLM-powered application in Rust.
source: https://github.com/AdamStrojek/rust-agentai
version: "0.1.5"
license: Apache-2.0
---

# Rust Agent Development with agentai

Build AI agents in Rust using the [`agentai`](https://crates.io/crates/agentai) crate. It wraps the `genai` library for multi-provider LLM access and adds structured output, custom toolboxes, MCP server integration, and built-in web tools.

> **Warning:** This library is under heavy development. The interface may change between versions.

---

## Process

### Phase 1 — Setup

Add the crate to your project:

```bash
cargo add agentai
cargo add tokio --features full
cargo add anyhow
cargo add serde --features derive
cargo add schemars
```

For logging (used in all examples):
```bash
cargo add log simplelog
```

Set environment variables:
```bash
AGENTAI_BASE_URL=https://openrouter.ai/api/v1   # or any OpenAI-compatible endpoint
AGENTAI_API_KEY=your_key_here
AGENTAI_MODEL=openai/gpt-4.1-mini               # optional, fallback default
```

Load [📋 Agent Patterns](./reference/agent_patterns.md) before implementing any agent.

---

### Phase 2 — Choose Your Agent Type

Decide what kind of agent you need based on the output and tool requirements:

| Type | Output | Tools | Reference |
|------|--------|-------|-----------|
| Simple Q&A | `String` | None | `examples/simple.rs` |
| Structured output | Custom struct | None | `examples/struct_output.rs` |
| Custom tools | String or struct | `#[toolbox]` impl | `examples/tools_custom.rs` |
| MCP integration | String or struct | `McpToolBox` | `examples/tools_mcp.rs` |
| Web search/fetch | String or struct | `ToolBoxSet` | `examples/tools_web.rs` |

Load [🔧 Toolbox Patterns](./reference/toolbox_patterns.md) if your agent uses tools.

---

### Phase 3 — Implementation

#### 3.1 Core Agent Loop

Every agent follows the same pattern:

```rust
let mut agent = Agent::new_with_url(&base_url, &api_key, SYSTEM);
let answer: YourOutputType = agent.run(&model, question, toolbox_option).await?;
```

The return type `YourOutputType` drives the behaviour:
- `String` → plain text response, no JSON schema enforced
- Any struct deriving `Deserialize + JsonSchema` → structured JSON output via LLM response format

#### 3.2 Structured Output Convention

Always include a `_thinking` field in structured output structs — it gives the LLM a scratchpad and improves answer quality:

```rust
#[derive(Deserialize, JsonSchema, Debug)]
struct Answer {
    /// In this field provide your thinking steps
    #[serde(rename = "_thinking")]
    thinking: String,

    /// In this field provide the final answer
    answer: String,
}
```

#### 3.3 Tool Selection

- **No external tools needed** → pass `None` as toolbox
- **Single custom toolbox** → pass `Some(&your_toolbox)`
- **Multiple toolboxes** → compose with `ToolBoxSet`
- **MCP server** → use `McpToolBox::new(cmd, args, env)`
- **Web tools** → use `WebFetchToolBox` and/or `WebSearchToolBox` (requires `BRAVE_API_KEY` for search)

---

### Phase 4 — Review

Before shipping, verify:
- [ ] Structured output structs include `_thinking` field
- [ ] Environment variables documented (`AGENTAI_BASE_URL`, `AGENTAI_API_KEY`, `AGENTAI_MODEL`)
- [ ] Tool descriptions are precise and action-oriented
- [ ] Error handling uses `anyhow::Result` consistently
- [ ] Max iteration limit (currently hardcoded to 5) is acceptable for your use case
- [ ] `cargo build` passes without warnings

---

## Key Constraints

- **Max iterations**: hardcoded to 5 — if the agent hasn't answered in 5 LLM calls, it returns an error
- **Temperature**: hardcoded to 0.2 — not currently configurable
- **Streaming**: not supported yet
- **Agent memory**: not persistent across `agent.run()` calls within the same `Agent` instance (history is maintained), but not across program restarts
- **String return type workaround**: returning `String` uses an internal escape hack — prefer structured output for complex use cases

---

## Reference Files

- [📋 Agent Patterns](./reference/agent_patterns.md) — initialization, run loop, structured output, multi-run conversations
- [🔧 Toolbox Patterns](./reference/toolbox_patterns.md) — custom tools, MCP, web tools, ToolBoxSet composition
- [simple.rs](./reference/examples/simple.rs) — minimal agent, string output
- [struct_output.rs](./reference/examples/struct_output.rs) — structured output with `_thinking`
- [tools_custom.rs](./reference/examples/tools_custom.rs) — custom tool with `#[toolbox]` + `#[tool]` macros
- [tools_mcp.rs](./reference/examples/tools_mcp.rs) — MCP server integration
- [tools_web.rs](./reference/examples/tools_web.rs) — built-in web search + fetch with ToolBoxSet
