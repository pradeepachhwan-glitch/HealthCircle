/**
 * Unified AI client for HealthCircle.
 *
 * Strategy: try Anthropic (claude-haiku-4-5 — very fast) first, fall back to
 * OpenAI (gpt-4o-mini) if Anthropic isn't configured or fails. Both calls have
 * tight timeouts so the user never waits more than ~10s in the worst case.
 *
 * All callers pass a JSON-shaped prompt. The client guarantees JSON parsing
 * (or null if both providers fail), so the rest of the codebase stays simple.
 */
import { logger } from "./logger";

export interface AIChatOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Conversation history as plain {role, content} pairs. Optional. */
  history?: { role: string; content: string }[];
  /** Optional vision (image/PDF) attachment passed through as a Claude image_url. */
  attachment?: { url: string; type: string } | null;
  /** Hard timeout per provider attempt. Default 8000 ms. */
  timeoutMs?: number;
  /** Response cap in tokens. Default 800. */
  maxTokens?: number;
  /** If true, request strict JSON object response (where supported). */
  jsonMode?: boolean;
  /** Any provider-specific override. */
  modelOverride?: { anthropic?: string; openai?: string };
}

export interface AIChatResult {
  /** Raw text content from the model. */
  text: string;
  provider: "anthropic" | "openai";
  /** True if the call succeeded. */
  ok: true;
}

export interface AIChatFailure {
  ok: false;
  error: string;
}

const ANTHROPIC_DEFAULT = "claude-haiku-4-5";
const OPENAI_DEFAULT = "gpt-4o-mini";

function hasAnthropic(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}
function hasOpenAI(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

interface AnthropicTextBlock { type: "text"; text: string }
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  stop_reason?: string;
}

async function callAnthropic(opts: AIChatOptions): Promise<AIChatResult | AIChatFailure> {
  const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!;
  const model = opts.modelOverride?.anthropic ?? ANTHROPIC_DEFAULT;
  const maxTokens = opts.maxTokens ?? 800;
  const timeoutMs = opts.timeoutMs ?? 8000;

  // Anthropic messages format: history + final user turn.
  // NOTE: Anthropic vision requires base64-encoded images (not URLs). For
  // simplicity we route any image-attachment call to OpenAI by returning a
  // failure here — aiChat will fall through to OpenAI which DOES accept URLs.
  if (opts.attachment?.url && opts.attachment.type.startsWith("image/")) {
    return { ok: false, error: "Anthropic vision requires base64; deferring to OpenAI for image attachments" };
  }

  type Block = { type: "text"; text: string };
  const history = (opts.history ?? []).slice(-10).map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text" as const, text: m.content }],
  }));

  const userBlocks: Block[] = [{ type: "text", text: opts.userPrompt }];

  const body = {
    model,
    max_tokens: maxTokens,
    system: opts.jsonMode ? `${opts.systemPrompt}\n\nIMPORTANT: Respond with ONLY valid JSON, no markdown fences, no prose.` : opts.systemPrompt,
    messages: [...history, { role: "user", content: userBlocks }],
  };

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { ok: false, error: `Anthropic ${response.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await response.json()) as AnthropicResponse;
    const text = (data.content ?? []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (!text) return { ok: false, error: "Anthropic: empty response" };
    return { ok: true, text, provider: "anthropic" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Anthropic fetch failed" };
  }
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

async function callOpenAI(opts: AIChatOptions): Promise<AIChatResult | AIChatFailure> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY!;
  const model = opts.modelOverride?.openai ?? OPENAI_DEFAULT;
  const maxTokens = opts.maxTokens ?? 800;
  const timeoutMs = opts.timeoutMs ?? 8000;

  // OpenAI accepts a vision content array on the user turn.
  type OpenAIContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
  let userContent: OpenAIContent = opts.userPrompt;
  if (opts.attachment?.url && opts.attachment.type.startsWith("image/")) {
    userContent = [
      { type: "text", text: opts.userPrompt },
      { type: "image_url", image_url: { url: opts.attachment.url } },
    ];
  }

  const messages: { role: string; content: OpenAIContent }[] = [
    { role: "system", content: opts.systemPrompt },
    ...(opts.history ?? []).slice(-10).map(m => ({ role: m.role, content: m.content as OpenAIContent })),
    { role: "user", content: userContent },
  ];

  const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { ok: false, error: `OpenAI ${response.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await response.json()) as OpenAIResponse;
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "OpenAI: empty response" };
    return { ok: true, text, provider: "openai" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "OpenAI fetch failed" };
  }
}

/**
 * Call the AI with automatic provider selection and fallback. Returns the raw
 * text content. Caller is responsible for parsing JSON if jsonMode=true.
 */
export async function aiChat(opts: AIChatOptions): Promise<AIChatResult | AIChatFailure> {
  if (hasAnthropic()) {
    const a = await callAnthropic(opts);
    if (a.ok) return a;
    logger.warn({ err: a.error }, "Anthropic failed, falling back to OpenAI");
    if (hasOpenAI()) {
      const o = await callOpenAI(opts);
      if (o.ok) return o;
      logger.error({ anthropic: a.error, openai: o.error }, "Both AI providers failed");
      return o;
    }
    return a;
  }
  if (hasOpenAI()) {
    return callOpenAI(opts);
  }
  return { ok: false, error: "No AI provider configured (Anthropic or OpenAI)" };
}

/** Convenience: aiChat + safe JSON parse. Returns null on any failure. */
export async function aiChatJson<T>(opts: AIChatOptions): Promise<T | null> {
  const result = await aiChat({ ...opts, jsonMode: true });
  if (!result.ok) return null;
  try {
    // Strip ```json ... ``` fences if a model wrapped them despite instructions.
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
