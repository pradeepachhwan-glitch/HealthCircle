import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { db, googleTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "https://telehealthcircle.com/api/auth/callback/google";

export function getOAuthClient() {
  if (!clientId || !clientSecret) {
    logger.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthUrl(userId: number) {
  const client = getOAuthClient();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: JSON.stringify({ userId }),
    prompt: "consent",
  });
}

export async function handleAuthCallback(userId: number, code: string) {
  const client = getOAuthClient();
  if (!client) return null;

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token || !tokens.access_token || !tokens.expiry_date) {
    throw new Error("Invalid tokens received from Google");
  }

  // Fetch Google user email
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const userInfo = await oauth2.userinfo.get();
  const googleEmail = userInfo.data.email ?? null;

  await db
    .insert(googleTokensTable)
    .values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      googleEmail,
      expiryDate: new Date(tokens.expiry_date),
    })
    .onConflictDoUpdate({
      target: googleTokensTable.userId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        googleEmail,
        expiryDate: new Date(tokens.expiry_date),
        updatedAt: new Date(),
      },
    });

  return tokens;
}

export async function getAuthorizedClient(userId: number) {
  const [tokenRow] = await db
    .select()
    .from(googleTokensTable)
    .where(eq(googleTokensTable.userId, userId))
    .limit(1);

  if (!tokenRow) return null;

  const client = getOAuthClient();
  if (!client) return null;

  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.expiryDate.getTime(),
  });

  // Automatically refresh if expired
  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db
        .update(googleTokensTable)
        .set({
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(googleTokensTable.userId, userId));
    }
  });

  return client;
}

export async function createMeetEvent(userId: number, details: {
  summary: string;
  description: string;
  startTime: Date;
  durationMinutes: number;
  attendees?: string[];
}) {
  const client = await getAuthorizedClient(userId);
  if (!client) {
    logger.warn({ userId }, "No Google Calendar authorization found for user");
    return null;
  }

  const calendar = google.calendar({ version: "v3", auth: client });

  const endTime = new Date(details.startTime.getTime() + details.durationMinutes * 60000);

  const event = {
    summary: details.summary,
    description: details.description,
    start: {
      dateTime: details.startTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    conferenceData: {
      createRequest: {
        requestId: `meet_${Date.now()}_${userId}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    attendees: details.attendees?.map(email => ({ email })) ?? [],
    reminders: {
      useDefault: true,
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
    conferenceDataVersion: 1,
  });

  return {
    eventId: response.data.id,
    meetUrl: response.data.hangoutLink,
  };
}
