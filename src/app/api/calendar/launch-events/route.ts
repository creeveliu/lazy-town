import { NextResponse } from "next/server";
import { getLaunchEventsFromDb } from "@/lib/db";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatICSDateNext(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET() {
  const events = await getLaunchEventsFromDb();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LazyTown//LaunchCalendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:科技发布会",
  ];

  for (const event of events) {
    const description = `${escapeText(event.platform)} | ${escapeText(event.title)}`;
    const uid = `${event.url}@lazytown`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDateNext(event.date)}`);
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=launches.ics",
    },
  });
}
