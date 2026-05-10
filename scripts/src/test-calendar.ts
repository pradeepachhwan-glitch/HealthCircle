import { google } from 'googleapis';

async function testCalendar() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    });
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient as any });

    console.log("Auth successful, attempting to list events...");
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    console.log("Events:", res.data.items);
  } catch (err) {
    console.error("Calendar test failed:", err);
  }
}

testCalendar();
