import { NextResponse } from "next/server";
import { getGlobalOnlineMoviesFromDb } from "@/lib/db";

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
  const movies = await getGlobalOnlineMoviesFromDb();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LazyTown//GlobalOnlineMovieCalendar//US",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:海外流媒体",
  ];

  for (const movie of movies) {
    const platforms = movie.platforms.join(", ");
    const summary = `${movie.title} 上线 ${platforms}`;
    const description = `${escapeText(movie.originalTitle)} | ${escapeText(platforms)} | ${escapeText(movie.sourceName)} | ${escapeText(movie.url)}`;
    const uid = `${movie.url}@global-online-movies.lazy-town`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(movie.onlineDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDateNext(movie.onlineDate)}`);
    lines.push(`SUMMARY:${escapeText(summary)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`URL:${movie.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=global-online-movies.ics",
    },
  });
}
