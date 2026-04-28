import { db, commentsTable, postsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { YUKTI_BOT_CLERK_ID } from "./startupSeed";

export const ASKyukti_PATTERN = /@askYukti/i;

export function mentionsYukti(text: string): boolean {
  return ASKyukti_PATTERN.test(text);
}

async function getYuktiBotId(): Promise<number | null> {
  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, YUKTI_BOT_CLERK_ID))
    .limit(1);
  return row?.id ?? null;
}

async function callAI(prompt: string): Promise<string | null> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 450,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function generateYuktiPostReply(postId: number, title: string, content: string): Promise<void> {
  try {
    const botId = await getYuktiBotId();
    if (!botId) return;

    const prompt = `You are Yukti, an empathetic India-first AI health assistant. A community member tagged @askYukti in their post seeking your help.

Post title: "${title}"
Post content: "${content.slice(0, 600)}"

Reply with a warm, practical, medically responsible response in 3-4 short paragraphs. Use simple language. Include:
1. Acknowledge their concern and validate their question
2. Provide helpful health context (without diagnosing)
3. Practical next steps they can take now
4. When to consult a doctor

Always end with a reminder that this is AI guidance, not a professional diagnosis. Keep the tone caring and clear. Do NOT use markdown headers or bullet points — write in natural conversational paragraphs.`;

    const reply = await callAI(prompt);
    if (!reply) return;

    await db.insert(commentsTable).values({
      postId,
      authorId: botId,
      content: reply,
    });

    await db
      .update(postsTable)
      .set({ commentCount: sql`${postsTable.commentCount} + 1` })
      .where(eq(postsTable.id, postId));

    logger.info({ postId }, "Yukti bot replied to @askYukti post mention");
  } catch (err) {
    logger.error({ err, postId }, "Yukti bot post reply failed");
  }
}

export async function generateYuktiCommentReply(postId: number, commentContent: string, postTitle: string, postBody: string): Promise<void> {
  try {
    const botId = await getYuktiBotId();
    if (!botId) return;

    const prompt = `You are Yukti, an empathetic India-first AI health assistant. A community member tagged @askYukti in a reply, seeking your help.

Original post: "${postTitle}"
Post details: "${postBody.slice(0, 300)}"
Their comment/question: "${commentContent.slice(0, 400)}"

Reply with a warm, targeted response in 2-3 short paragraphs. Use simple language. Address their specific comment or question. Provide practical guidance and mention when they should see a doctor. Do NOT use markdown headers or bullet points. Keep it conversational and caring. End with a gentle disclaimer that this is AI guidance only.`;

    const reply = await callAI(prompt);
    if (!reply) return;

    await db.insert(commentsTable).values({
      postId,
      authorId: botId,
      content: reply,
    });

    await db
      .update(postsTable)
      .set({ commentCount: sql`${postsTable.commentCount} + 1` })
      .where(eq(postsTable.id, postId));

    logger.info({ postId }, "Yukti bot replied to @askYukti comment mention");
  } catch (err) {
    logger.error({ err, postId }, "Yukti bot comment reply failed");
  }
}
