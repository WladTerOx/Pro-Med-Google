## Purpose

Exposes the PubMed search, retrieval, and AI-assisted analysis
capabilities as a set of MCP (Model Context Protocol) tools served over
HTTP, so that external agents (Hermes, Claude, custom corporate bots)
can drive PubMed workflows from any host that can reach the server.

## ADDED Requirements

### Requirement: MCP server endpoint

The system SHALL expose an HTTP endpoint that speaks JSON-RPC 2.0 over
the MCP Streamable HTTP transport. The endpoint MUST be reachable from
the local machine via `http://127.0.0.1:8765/mcp` and from the public
internet via `https://mcp.openaiua.cloud/mcp`. A request to the root
path SHALL return `200 OK` with a small JSON document of the form
`{"name": "pubmed-mcp", "version": "<semver>"}` so operators can verify
reachability with a plain `curl`.

#### Scenario: Loopback reachability
- **WHEN** an operator runs `curl -s http://127.0.0.1:8765/` from the
  host that runs the server
- **THEN** the response body decodes to JSON with `name` ===
  `'pubmed-mcp'` and HTTP status `200`

#### Scenario: Public DNS resolves
- **WHEN** a client on another VPS runs
  `curl -s https://mcp.openaiua.cloud/`
- **THEN** the response is identical to the loopback case (Traefik
  forwards the request to the local server)

#### Scenario: Foreign hostname rejected
- **WHEN** a request hits `mcp.openaiua.cloud` with
  `Host: attacker.example`
- **THEN** Traefik rejects the request with HTTP 421 (misdirected
  request) before the MCP server is touched

### Requirement: Streamable HTTP transport

The server SHALL implement the MCP Streamable HTTP transport as
specified in the MCP specification (revision 2025-03-26 or later).
The server MUST accept `POST /mcp` requests with a JSON-RPC 2.0
envelope, return a JSON response when the client does not advertise
streaming, and switch to `text/event-stream` SSE responses when the
client includes `Accept: text/event-stream`. The server MUST emit the
header `MCP-Protocol-Version: <detected-version>` on every response
so clients can detect version mismatch.

#### Scenario: Single-shot request
- **WHEN** a client sends
  `POST /mcp` with body `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
  and `Accept: application/json`
- **THEN** the server returns HTTP 200 with a JSON object containing
  `result.tools` listing every registered tool

#### Scenario: Server-initiated stream
- **WHEN** a client sends the same request with
  `Accept: text/event-stream, application/json`
- **THEN** the server returns HTTP 200 with `Content-Type:
  text/event-stream` and a stream of `event: message\ndata: ...`
  frames

#### Scenario: Malformed JSON body
- **WHEN** a client sends `POST /mcp` with body `{not json`
- **THEN** the server returns HTTP 400 with a JSON-RPC parse error
  (`code: -32700`) and does not crash

### Requirement: Tool registration

The server SHALL register the following six tools, each with a
JSON-schema describing its inputs and outputs:

| Tool name | Purpose |
| --- | --- |
| `search_pubmed` | Search PubMed by free-text query, return list of articles |
| `get_article_details` | Fetch a single article by PMID |
| `translate_query` | Translate a non-English query into English for PubMed |
| `optimize_query` | Compress a long natural-language query into PubMed-syntax keywords |
| `summarize_article` | Explain a PubMed article in plain language |
| `translate_titles` | Translate a list of article titles into a target language |

`tools/list` SHALL return all six tools with `inputSchema` validated
JSON Schema. Each tool's `description` SHALL be one short sentence
in English so an LLM agent can pick it correctly.

#### Scenario: Listing tools
- **WHEN** a client calls `tools/list`
- **THEN** the response payload contains exactly six tool entries with
  names `search_pubmed`, `get_article_details`, `translate_query`,
  `optimize_query`, `summarize_article`, `translate_titles`

#### Scenario: Each tool has a JSON schema
- **WHEN** a client inspects `result.tools[*].inputSchema`
- **THEN** each entry is a valid JSON Schema object (`type`, `properties`,
  `required` where applicable) and contains no `$ref` to the host
  filesystem

### Requirement: search_pubmed tool

`search_pubmed(query, max_results=10)` SHALL run a PubMed ESearch query
and return a JSON array of `{ pmid, title, authors[], journal, pubDate,
hasAbstract }`. The tool MUST clamp `max_results` to the range
`[1, 50]`; values outside that range return a JSON-RPC invalid-params
error (`code: -32602`). When PubMed returns no hits, the tool returns
an empty array, not an error.

#### Scenario: Typical search
- **WHEN** the tool is called with `query: "coffee cardiovascular diabetes"`
  and `max_results: 5`
- **THEN** the response contains between 1 and 5 article entries, each
  with a valid integer `pmid` and a non-empty `title`

#### Scenario: max_results clamping
- **WHEN** the tool is called with `max_results: 0`
- **THEN** the server returns a JSON-RPC error with `code: -32602`
  and a message mentioning `max_results must be between 1 and 50`

#### Scenario: PubMed returns nothing
- **WHEN** the tool is called with a query that yields zero hits
- **THEN** the response is `{"content": [{"type": "json",
  "json": []}], "isError": false}` (empty array, not error)

### Requirement: get_article_details tool

`get_article_details(pmid)` SHALL call PubMed EFetch and return
`{ pmid, title, abstract, authors[], journal, pubDate }`. The tool
SHALL reject non-integer `pmid` values with `code: -32602`. When the
PMID does not exist, the tool returns `isError: true` with a
message of the form `PubMed returned no article for pmid <id>`.

#### Scenario: Real PMID
- **WHEN** the tool is called with `pmid: 33234566` (an example real
  PMID for tests)
- **THEN** the response contains a non-empty `title` and a non-empty
  `abstract` (or `null` if the article has no abstract)

#### Scenario: Non-integer PMID
- **WHEN** the tool is called with `pmid: "abc"`
- **THEN** the server returns a JSON-RPC error with `code: -32602`
  and a message mentioning `pmid must be an integer`

### Requirement: translate_query tool

`translate_query(query, target_lang="en")` SHALL route to the
existing AI provider fallback chain (mistral → MiniMax → gemini →
ollama) and return the translated query as a plain string. When
`target_lang` is not `'en'`, the tool MUST return the original
`query` unchanged without contacting any AI provider. When every AI
provider is unavailable, the tool returns `isError: true` with the
message `ALL_AI_PROVIDERS_UNAVAILABLE` so the agent can react.

#### Scenario: Russian to English
- **WHEN** the tool is called with `query: "лечение головной боли"`
  and `target_lang: "en"`
- **THEN** the response contains a single string of English medical
  terms (e.g. `"headache treatment"` or similar)

#### Scenario: Unsupported target language
- **WHEN** the tool is called with `target_lang: "fr"`
- **THEN** the response is identical to the input query and no AI
  provider is contacted

#### Scenario: All providers down
- **WHEN** every AI provider in the fallback chain is unavailable
- **THEN** the tool returns `isError: true` with the standard
  `ALL_AI_PROVIDERS_UNAVAILABLE` message

### Requirement: optimize_query tool

`optimize_query(long_query)` SHALL call the AI fallback chain with
the same optimization prompt used by the frontend
(`optimizeQueryForPubMed`). The tool SHALL reject empty strings with
`code: -32602` and return the optimized query as a single string.

#### Scenario: Long query
- **WHEN** the tool is called with a multi-sentence query
- **THEN** the response string is under 200 characters and contains
  only medical keywords (no full sentences)

#### Scenario: Empty input
- **WHEN** the tool is called with `long_query: ""`
- **THEN** the server returns `code: -32602` with a message mentioning
  `long_query must be a non-empty string`

### Requirement: summarize_article tool

`summarize_article(pmid, lang="ru")` SHALL fetch the article by PMID
and produce a plain-language summary in the requested language using
the AI fallback chain. The tool MUST support `lang: "ru"` (default)
and `lang: "en"`. When the PMID does not exist, the tool returns
`isError: true` so the agent does not retry.

#### Scenario: Russian summary
- **WHEN** the tool is called with a real PMID and `lang: "ru"`
- **THEN** the response is a paragraph in Russian explaining the
  article's main finding

#### Scenario: English summary
- **WHEN** the tool is called with `lang: "en"`
- **THEN** the response is a paragraph in English

#### Scenario: Unsupported language
- **WHEN** the tool is called with `lang: "fr"`
- **THEN** the server returns `code: -32602` with a message mentioning
  `lang must be 'ru' or 'en'`

### Requirement: translate_titles tool

`translate_titles(pmids[], target_lang="ru")` SHALL fetch each PMID,
extract the title, and translate the batch. The tool SHALL reject
arrays longer than 50 elements with `code: -32602` to bound AI token
costs. When `target_lang` is `'en'`, the tool returns the original
English titles without calling any AI provider.

#### Scenario: Batch of 10 PMIDs
- **WHEN** the tool is called with 10 valid PMIDs and
  `target_lang: "ru"`
- **THEN** the response is an array of 10 Russian strings in the
  same order as the input

#### Scenario: Empty list
- **WHEN** the tool is called with `pmids: []`
- **THEN** the server returns `code: -32602` with a message mentioning
  `pmids must be a non-empty array`

#### Scenario: Oversized batch
- **WHEN** the tool is called with 60 PMIDs
- **THEN** the server returns `code: -32602` with a message mentioning
  the 50-element limit

### Requirement: AI provider parity

The MCP server SHALL use the same AI provider fallback chain
(`mistral → MiniMax → gemini → ollama`) as the frontend
`services/ai.ts`. The same `ALL_AI_PROVIDERS_UNAVAILABLE` error
contract SHALL be exposed to MCP clients. Adding or removing a
provider on the frontend side MUST be mirrored in the MCP server's
configuration so the two surfaces stay in sync.

#### Scenario: Provider priority match
- **WHEN** a tool that hits the AI chain is invoked and the first
  provider is healthy
- **THEN** the AI chain skips the remaining providers exactly the
  same way the frontend would

#### Scenario: Chain exhaustion
- **WHEN** every provider in the chain returns an error
- **THEN** the tool returns `isError: true` with the message
  `ALL_AI_PROVIDERS_UNAVAILABLE`

### Requirement: Rate limiting per token

The server SHALL enforce a per-token rate limit of **60 requests
per minute** to protect the upstream AI providers and PubMed against
runaway agents. When a token exceeds the limit, the server MUST
return HTTP 429 with `Retry-After: <seconds>` and a JSON-RPC error
whose `code` is `-32000` and `message` is `Rate limit exceeded`.

#### Scenario: Burst within limit
- **WHEN** a client issues 60 requests in 60 seconds with a valid
  token
- **THEN** all 60 requests succeed

#### Scenario: Burst over limit
- **WHEN** the same client issues a 61st request within the same
  minute
- **THEN** the server returns HTTP 429 with `Retry-After: <seconds>`
  and the JSON-RPC error described above

#### Scenario: Loopback is exempt
- **WHEN** a request comes from `127.0.0.1` (no token)
- **THEN** the rate limiter is not applied

### Requirement: Server health checks

The server SHALL expose `GET /health` returning
`{"status": "ok", "uptime_s": <integer>, "tokens_active": <integer>}`
with HTTP 200 when the process is alive. The server SHALL expose
`GET /ready` returning HTTP 200 only when the AI provider chain has
been probed at least once successfully OR the chain is empty
(no providers configured). These endpoints MUST NOT require
authentication.

#### Scenario: Liveness
- **WHEN** an operator runs `curl http://127.0.0.1:8765/health`
- **THEN** the response is HTTP 200 with the JSON described above

#### Scenario: Readiness during boot
- **WHEN** the server has just started and the AI chain has not yet
  been probed
- **THEN** `GET /ready` returns HTTP 503 with
  `{"status": "probing"}` until the first probe completes

### Requirement: Structured logging

The server SHALL emit structured JSON logs (one object per line) to
stdout via `pino`. Each log entry MUST include `ts`, `level`,
`msg`, `requestId`, `tokenId` (or `"anonymous"` for loopback), and
`tool` (when a tool call is logged). The server MUST NOT log
bearer tokens, AI keys, or PubMed API keys at any level.

#### Scenario: Successful tool call
- **WHEN** a tool call completes successfully
- **THEN** the log line includes `level: "info"`, the tool name, the
  duration in ms, and the token ID

#### Scenario: Failed tool call
- **WHEN** a tool call throws an error
- **THEN** the log line includes `level: "error"`, the error message,
  and the stack trace trimmed to the top 5 frames

#### Scenario: Secret redaction
- **WHEN** a request body contains a header like
  `Authorization: Bearer sk-abc…`
- **THEN** the log line shows `Authorization: Bearer [REDACTED]`
