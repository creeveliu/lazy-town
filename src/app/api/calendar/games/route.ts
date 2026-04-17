import { NextResponse } from "next/server";
import { getGamesFromDb } from "@/lib/db";

function heatLabel(heat: number): string {
  if (heat > 15000) return "爆款";
  if (heat > 8000) return "热门";
  return "普通";
}

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
  const games = await getGamesFromDb();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LazyTown//GameCalendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:热门游戏",
  ];

  for (const game of games) {
    const platforms = game.platforms.join(", ");
    const label = heatLabel(game.heat);
    const description = `${escapeText(label)} | ${escapeText(platforms)}`;
    const uid = `${game.url}@gamersky.com`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(game.releaseDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDateNext(game.releaseDate)}`);
    lines.push(`SUMMARY:${escapeText(game.title)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`URL:${game.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=games.ics",
    },
  });
}
