/**
 * Unified AI client for HealthCircle.
 *
 * OpenAI-only implementation for Yukti Engine.
 * Clean, stable, and minimal.
 */

import { logger } from "./logger";

export interface AIChatOptions {
  systemPrompt: string;
  userPrompt: string;
  history?: { role: string; content: string }[];
  attachment?: { url: string; type: string } | null;
  timeoutMs?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  modelOverride?: { openai?: string };
}

export interface AIChatResult {
  text: string;
  provider: "openai";
  ok: true;
}

export interface AIChatFailure {
  ok: false;
  error: string;
}

const OPENAI_DEFAULT = "gpt-4o-mini";

function hasOpenAI(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  );
}

interface OpenAIResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

async function callOpenAI(
  opts: AIChatOptions
): Promise<AIChatResult | AIChatFailure> {

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY!;

  const model =
    opts.modelOverride?.openai ??
    OPENAI_DEFAULT;

  const maxTokens = opts.maxTokens ?? 800;
  const timeoutMs = opts.timeoutMs ?? 12000;

  type OpenAIContent =
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];

  let userContent: OpenAIContent = opts.userPrompt;

  // Vision support
  if (
    opts.attachment?.url &&
    opts.attachment.type.startsWith("image/")
  ) {
    userContent = [
      {
        type: "text",
        text: opts.userPrompt,
      },
      {
        type: "image_url",
        image_url: {
          url: opts.attachment.url,
        },
      },
    ];
  }

  const messages: Array<{
    role: string;
    content: OpenAIContent;
  }> = [
    {
      role: "system",
      content: opts.jsonMode
        ? `${opts.systemPrompt}

IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No explanation
- No code fences`
        : opts.systemPrompt,
    },

    ...(opts.history ?? [])
      .slice(-10)
      .map(m => ({
        role: m.role,
        content: m.content as OpenAIContent,
      })),

    {
      role: "user",
      content: userContent,
    },
  ];

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.4,
  };

  if (opts.jsonMode) {
    body.response_format = {
      type: "json_object",
    };
  }

  try {

    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (!response.ok) {

      const errText = await response
        .text()
        .catch(() => "");

      logger.error({
        provider: "openai",
        status: response.status,
        error: errText,
      });

      return {
        ok: false,
        error: `OpenAI ${response.status}: ${errText.slice(0, 500)}`,
      };
    }

    const data =
      (await response.json()) as OpenAIResponse;

    const text =
      data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {

      logger.error({
        provider: "openai",
        error: "Empty response",
      });

      return {
        ok: false,
        error: "OpenAI returned empty response",
      };
    }

    return {
      ok: true,
      text,
      provider: "openai",
    };

  } catch (err) {

    logger.error({
      provider: "openai",
      error:
        err instanceof Error
          ? err.message
          : "Unknown OpenAI error",
    });

    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "OpenAI fetch failed",
    };
  }
}

/**
 * Main AI chat entrypoint
 */
export async function aiChat(
  opts: AIChatOptions
): Promise<AIChatResult | AIChatFailure> {

  if (!hasOpenAI()) {
    return {
      ok: false,
      error: "OpenAI not configured",
    };
  }

  return await callOpenAI(opts);
}

/**
 * AI chat + safe JSON parse
 */
export async function aiChatJson<T>(
  opts: AIChatOptions
): Promise<T | null> {

  const result = await aiChat({
    ...opts,
    jsonMode: true,
  });

  if (!result.ok) {

    logger.error({
      provider: "openai",
      error: result.error,
    });

    return null;
  }

  try {

    const cleaned = result.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const jsonMatch =
      cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {

      logger.error({
        provider: "openai",
        error: "No JSON found",
        raw: cleaned,
      });

      return null;
    }

    return JSON.parse(jsonMatch[0]) as T;

  } catch (err) {

    logger.error({
      provider: "openai",
      error:
        err instanceof Error
          ? err.message
          : "JSON parse failed",
      raw: result.text,
    });

    return null;
  }
}
