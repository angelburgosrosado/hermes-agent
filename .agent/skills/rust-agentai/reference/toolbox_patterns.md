# Toolbox Patterns — agentai

## Custom Tools via Macros

Use `#[toolbox]` on the `impl` block and `#[tool]` on each method. The macros auto-generate `ToolBox` trait implementation.

```rust
use agentai::tool::{toolbox, ToolResult};

struct MyToolBox {}

#[toolbox]
impl MyToolBox {
    #[tool]
    /// Fetches the content of a URL and returns it as text
    async fn web_fetch(
        &self,
        /// The URL to fetch
        url: String,
    ) -> ToolResult {
        Ok(reqwest::get(url).await?.text().await?)
    }

    #[tool]
    /// Returns the current UTC timestamp as ISO 8601
    async fn current_time(&self) -> ToolResult {
        Ok(chrono::Utc::now().to_rfc3339())
    }
}
```

**Rules:**
- Method must be `async`
- Return type must be `ToolResult` (alias for `Result<String, ToolError>`)
- Doc comment on the method (`///`) becomes the tool description — write it as an instruction to the LLM
- Doc comments on parameters become the parameter descriptions in the schema
- `&self` is required — the struct can hold state (API clients, config, etc.)
- Tool name is derived from the method name (snake_case)

---

## MCP Server Integration

```rust
use agentai::tool::mcp::McpToolBox;

// Launch an MCP server subprocess
let mcp_tools = McpToolBox::new(
    "uvx",                                           // command
    ["mcp-server-time", "--local-timezone", "UTC"],  // args
    None,                                            // optional env vars
).await?;

let answer: Answer = agent.run(&model, question, Some(&mcp_tools)).await?;
```

Any stdio-based MCP server works. Examples:
- `uvx mcp-server-time` — time tools
- `uvx mcp-server-filesystem /path` — filesystem access
- `npx @modelcontextprotocol/server-brave-search` — Brave search

MCP errors are forwarded back to the LLM as ToolResponse messages rather than crashing the agent.

---

## Built-in Web Tools

Requires `web` feature flag (check current crate features). Add `BRAVE_API_KEY` env var for search.

```rust
use agentai::tool::web::{WebFetchToolBox, WebSearchToolBox};

let web_search = WebSearchToolBox::new(&brave_api_key);
let web_fetch = WebFetchToolBox::new();
```

---

## Composing Multiple Toolboxes

Use `ToolBoxSet` to combine multiple toolboxes into one:

```rust
use agentai::tool::ToolBoxSet;

let mut toolbox = ToolBoxSet::new();
toolbox.add_tool(web_search_tool);
toolbox.add_tool(web_fetch_tool);
toolbox.add_tool(my_custom_tool);

let answer: Answer = agent.run(&model, question, Some(&toolbox)).await?;
```

---

## Inspecting Tool Definitions

Useful for debugging — prints the JSON schema that gets sent to the LLM:

```rust
dbg!(toolbox.tools_definitions()?);
```

---

## Tool Design Guidelines

1. **One responsibility per tool** — don't combine fetch + parse into one tool; let the agent compose them
2. **Return plain text** — the LLM processes the string result; return JSON strings if structured data is needed
3. **Actionable errors** — return descriptive error messages the LLM can act on, not just error codes
4. **Idempotent where possible** — the agent may call the same tool multiple times
5. **Name tools with verb prefixes** — `fetch_`, `search_`, `read_`, `list_`, `create_` — consistent with MCP naming conventions
