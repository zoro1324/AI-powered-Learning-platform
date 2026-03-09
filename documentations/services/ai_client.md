# `ai_client.py`

## Architecture
- Pattern: `Facade + Environment-based strategy router`.
- Centralizes all AI calls for text/chat/image.
- Routes backend by settings:
  - `IS_PRODUCTION` or `USE_FEATHERLESS_TEXT` -> Featherless via LangChain/OpenAI-compatible API.
  - otherwise -> local Ollama chat endpoint.
- Image generation currently uses Stable Diffusion in both modes (production path falls back to SD).

## Workflow Diagram
```mermaid
flowchart TD
  A[Caller Service] --> B{Request Type}
  B -->|Text| C{Use Featherless Text}
  C -->|Yes| D[Featherless Text Path]
  C -->|No| E[Ollama Text Path]
  B -->|Image| F{Use Featherless Image}
  F -->|Yes| G[Featherless Image Route]
  F -->|No| H[Stable Diffusion Route]
  D --> I[Return Text]
  E --> I
  G --> J[Return Image]
  H --> J
```

## LLM Call Points
- `_ollama_generate(prompt, system_prompt, json_mode, model)`
  - Endpoint: `OLLAMA_API_URL` transformed to `/api/chat`
  - Payload includes `messages` and optional `format: json`.
- `_featherless_generate(prompt, system_prompt, json_mode, model)`
  - Uses `get_langchain_llm()` and invokes with `SystemMessage` + `HumanMessage`.
  - Adds strict JSON instruction when `json_mode=True`.
- `get_langchain_llm(temperature)`
  - Production: `ChatOpenAI` with Featherless base URL.
  - Development: `ChatOllama`.

## Prompt Handling
- This service does not define domain prompts itself.
- It forwards `prompt` and optional `system_prompt` from caller services.
- JSON mode appends:
```text
Return only valid JSON. Do not add markdown, commentary, or code fences.
```
