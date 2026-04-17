import { NextResponse } from "next/server";
import { getMoviesFromDb } from "@/lib/db";

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
  const movies = await getMoviesFromDb();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LazyTown//MovieCalendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:热门电影",
  ];

  for (const movie of movies) {
    const info = [movie.genres || "-", movie.country || "-"].filter(Boolean).join(" / ");
    const description = escapeText(info);
    const uid = `${movie.url}@douban.com`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(movie.releaseDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDateNext(movie.releaseDate)}`);
    lines.push(`SUMMARY:${escapeText(movie.title)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`URL:${movie.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=movies.ics",
    },
  });
}
