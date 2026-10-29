import { loopDate } from "./loops";

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Fold content lines at 75 octets, as required by iCalendar. */
function fold(line: string) {
  const lines: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) {
      lines.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  lines.push(part);
  return lines.join("\r\n");
}

export function calendarEvent(input: {
  id: string;
  title: string;
  date: string;
  days: number;
  maps: string;
  link: string;
  now?: Date;
}) {
  const stamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const end = loopDate(input.date, Math.max(1, input.days));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//list-it//Ride calendar//EN",
    "BEGIN:VEVENT",
    `UID:${escapeText(input.id)}@list-it`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${input.date.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${end.replace(/-/g, "")}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(`Maps: ${input.maps}\nCrew: ${input.link}`)}`,
    `URL:${input.link}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
