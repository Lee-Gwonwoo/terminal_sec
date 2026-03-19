const ET_TIME_ZONE = "America/New_York";
const ISO_NAIVE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

function formatEtParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const partValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${partValue("year")}-${partValue("month")}-${partValue("day")}`,
    time: `${partValue("hour")}:${partValue("minute")}:${partValue("second")}`,
  };
}

export function toEtNaiveIso(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const et = formatEtParts(date);
  return `${et.date}T${et.time}`;
}

export function getEtDateString(value: string | Date): string {
  if (typeof value === "string" && ISO_NAIVE_RE.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
  }

  return formatEtParts(date).date;
}