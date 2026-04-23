# Agent Patterns — agentai

## Initialization

### Default client (uses env-based auth per genai crate conventions)
```rust
let mut agent = Agent::new("You are a helpful assistant");
```

### OpenAI-compatible endpoint (OpenRouter, local Ollama proxy, etc.)
```rust
let base_url = std::env::var("AGENTAI_BASE_URL")?;
let api_key = std::env::var("AGENTAI_API_KEY")?;
let mut agent = Agent::new_with_url(&base_url, &api_key, "You are a helpful assistant");
```

### Custom genai client
```rust
let client = ClientBuilder::default()
    .with_service_target_resolver(my_resolver)
    .build();
let mut agent = Agent::new_with_client(client, "You are a helpful assistant");
```

---

## Running the Agent

```rust
// String output
let answer: String = agent.run(&model, "Why is the sky blue?", None).await?;

// Structured output
let answer: MyStruct = agent.run(&model, "Why is the sky blue?", None).await?;

// With toolbox
let answer: MyStruct = agent.run(&model, question, Some(&toolbox)).await?;
```

The model string follows `genai` conventions:
- `"gpt-4o"` — OpenAI direct
- `"claude-opus-4-6"` — Anthropic direct
- `"openai/gpt-4.1-mini"` — via OpenRouter

---

## Structured Output

Derive `Deserialize + JsonSchema` on any struct. The agent will enforce the schema via LLM response format (JSON mode).

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema, Debug)]
struct Answer {
    /// In this field provide your thinking steps
    #[serde(rename = "_thinking")]
    thinking: String,

    /// Provide the final answer here
    answer: String,
}
```

**Rules:**
- Always include `_thinking` as the first field — it gives the model a scratchpad
- Field doc comments (`///`) become the JSON schema descriptions — write them as instructions to the LLM
- Use `#[serde(rename = "_thinking")]` so the field sorts first alphabetically in JSON (some models process fields in order)
- Nested structs and enums are supported
- Optional fields: use `Option<T>` — the schema marks them as not required

---

## Conversation History

`Agent` maintains history across multiple `.run()` calls on the same instance. Each call appends the user message and assistant response to the internal history:

```rust
let mut agent = Agent::new_with_url(&base_url, &api_key, SYSTEM);

// Turn 1
let r1: String = agent.run(&model, "What is Rust?", None).await?;

// Turn 2 — agent has context from turn 1
let r2: String = agent.run(&model, "Give me a code example.", None).await?;
```

History is **in-memory only** — it resets when the `Agent` instance is dropped.

---

## Model Selection Pattern

Read model from environment with fallback:
```rust
let model = std::env::var("AGENTAI_MODEL").unwrap_or("openai/gpt-4.1-mini".to_string());
```

---

## Error Handling

The agent returns `anyhow::Result<T>`. Common failure modes:
- Max iterations (5) exceeded without a text response — the agent is stuck in a tool loop
- JSON deserialization failure — the LLM returned malformed structured output
- Tool call error — propagated as a ToolResponse error message back to the LLM (not a hard crash)

```rust
match agent.run(&model, question, Some(&toolbox)).await {
    Ok(answer) => println!("{:?}", answer),
    Err(e) => eprintln!("Agent failed: {e}"),
}
```
