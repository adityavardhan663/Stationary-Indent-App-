/**
 * Issue Queue helpers (Phase 5A).
 *
 * Pure, non-mutating utilities for ordering and presenting pending indents.
 * Nothing in this module reads or writes global state, touches the DOM, or
 * mutates its arguments.
 *
 * Queue ordering (see sortIssueQueueIndents):
 *   1. Urgency:   Urgent -> Normal -> Not urgent (missing/unknown = Normal)
 *   2. neededBy:  earliest valid date first; missing/invalid last
 *   3. createdAt: newest first; missing/invalid last
 *   4. Original input order (final tie-breaker; ids/indent numbers are ignored)
 */

const URGENCY_PRIORITY = {
  Urgent: 1,
  Normal: 2,
  'Not urgent': 3
};

const URGENCY_ALIASES = {
  urgent: 'Urgent',
  normal: 'Normal',
  'not urgent': 'Not urgent'
};

const MONTH_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

// Reads one "Key: value" segment out of a legacy "A: x | B: y" remarks string.
// Spaces in keys are ignored so "Needed by" and "NeededBy" both match.
function parseRemarksField(remarks, targetKey) {
  if (typeof remarks !== 'string' || !remarks.trim()) return null;
  const wanted = targetKey.replace(/\s+/g, '').toLowerCase();
  const parts = remarks.split(/\s*\|\s*/);
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.substring(0, colonIdx).replace(/\s+/g, '').toLowerCase();
    const val = part.substring(colonIdx + 1).trim();
    if (!val) continue;
    if (key === wanted) {
      return val;
    }
  }
  return null;
}

/**
 * Maps a raw urgency string to 'Urgent' | 'Normal' | 'Not urgent', or null if
 * it is not a recognised value.
 */
export function normalizeUrgencyValue(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return URGENCY_ALIASES[key] || null;
}

/**
 * Display label for an indent's urgency. Always returns one of the three
 * labels: a missing, blank, or unrecognised value is 'Normal'.
 *
 * The legacy "Urgency: ..." remarks segment is consulted only when the
 * urgency field itself is absent or blank. A present-but-unrecognised
 * urgency is treated as unknown (Normal), not overridden by remarks.
 */
export function normalizeIndentUrgency(indent) {
  const direct = indent?.urgency;
  if (!isBlank(direct)) {
    return normalizeUrgencyValue(direct) || 'Normal';
  }
  return normalizeUrgencyValue(parseRemarksField(indent?.remarks, 'urgency')) || 'Normal';
}

/** Sort priority for a label (1 = first). Unknown labels rank as Normal. */
export function getUrgencyPriority(urgencyLabel) {
  return URGENCY_PRIORITY[urgencyLabel] || URGENCY_PRIORITY.Normal;
}

/** Badge colours for a label. Returns a fresh object on every call. */
export function getUrgencyBadgeStyle(urgencyLabel) {
  if (urgencyLabel === 'Urgent') {
    return {
      background: '#fee2e2',
      color: '#991b1b',
      border: '1px solid #fca5a5'
    };
  }
  if (urgencyLabel === 'Not urgent') {
    return {
      background: '#f1f5f9',
      color: '#475569',
      border: '1px solid #cbd5e1'
    };
  }
  return {
    background: '#dbeafe',
    color: '#1e40af',
    border: '1px solid #93c5fd'
  };
}

/**
 * Parses a date value to a UTC timestamp (ms), or null if unsupported/invalid.
 *
 * Supported inputs (the same set the backend accepts for neededBy):
 *   - Date objects (valid ones only)
 *   - 'YYYY-MM-DD'                         -> that calendar day at 00:00 UTC
 *   - 'YYYY-MM-DDTHH:mm:ss[.sss]Z|+HH:MM'  -> the exact instant
 *   - 'D Mon YYYY' (e.g. '28 Nov 2026')    -> that calendar day at 00:00 UTC
 *
 * Date-only forms are built with Date.UTC and never go through the host
 * timezone, so they cannot shift by a day. Impossible dates (e.g. 30 Feb)
 * are rejected rather than rolled over.
 */
export function parseDateValueToTimestamp(value) {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }

  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // 1. ISO date-only
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return Date.UTC(year, month - 1, day);
  }

  // 2. ISO datetime with explicit Z / offset
  const isoDateTimeMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
  );
  if (isoDateTimeMatch) {
    const year = Number(isoDateTimeMatch[1]);
    const month = Number(isoDateTimeMatch[2]);
    const day = Number(isoDateTimeMatch[3]);
    const hour = Number(isoDateTimeMatch[4]);
    const minute = Number(isoDateTimeMatch[5]);
    const second = Number(isoDateTimeMatch[6]);
    if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
      return null;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  // 3. Human-readable en-GB short form used by the mobile app: "28 Nov 2026"
  const humanMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,4})\s+(\d{4})$/);
  if (humanMatch) {
    const day = Number(humanMatch[1]);
    const month = MONTH_MAP[humanMatch[2].toLowerCase()];
    const year = Number(humanMatch[3]);
    if (!month || !isValidCalendarDate(year, month, day)) return null;
    return Date.UTC(year, month - 1, day);
  }

  return null;
}

/**
 * Timestamp (ms, UTC) of an indent's needed-by date, or null if there is none
 * or it is invalid.
 *
 * The legacy "Needed by: 29 Nov 2026 (3 days)" remarks segment is consulted
 * only when the neededBy field is absent or blank. A present-but-invalid
 * neededBy stays invalid.
 */
export function parseIndentNeededByTimestamp(indent) {
  const direct = indent?.neededBy;
  if (!isBlank(direct)) {
    return parseDateValueToTimestamp(direct);
  }

  const remarksNeededBy = parseRemarksField(indent?.remarks, 'needed by');
  if (!remarksNeededBy) return null;

  const match = remarksNeededBy.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const datePart = match ? match[1].trim() : remarksNeededBy;
  return parseDateValueToTimestamp(datePart);
}

/** 'D Mon YYYY' (UTC calendar day) for the needed-by date, or null if none/invalid. */
export function formatNeededByDisplay(indent) {
  const ts = parseIndentNeededByTimestamp(indent);
  if (ts === null) return null;
  const d = new Date(ts);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** createdAt as a timestamp (ms), or null if missing/invalid. Accepts strings and Dates. */
export function parseCreatedAtTimestamp(value) {
  if (isBlank(value)) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value !== 'string') return null;
  const t = Date.parse(value.trim());
  return Number.isNaN(t) ? null : t;
}

/**
 * Returns a NEW array of the same indent objects in Issue Queue order.
 * The input array and its objects are never modified or cloned.
 * A non-array input yields [].
 *
 * Order: urgency (Urgent, Normal, Not urgent; unknown = Normal), then earliest
 * valid neededBy (invalid/missing last), then newest createdAt (invalid/missing
 * last), then original input position. indentNo and _id are deliberately NOT
 * used as tie-breakers, so duplicate or missing values cannot reorder anything.
 */
export function sortIssueQueueIndents(indents) {
  if (!Array.isArray(indents)) return [];

  return indents
    .map((indent, index) => ({
      indent,
      index,
      priority: getUrgencyPriority(normalizeIndentUrgency(indent)),
      neededByTs: parseIndentNeededByTimestamp(indent),
      createdAtTs: parseCreatedAtTimestamp(indent?.createdAt)
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      if (a.neededByTs !== null && b.neededByTs !== null) {
        if (a.neededByTs !== b.neededByTs) return a.neededByTs - b.neededByTs;
      } else if (a.neededByTs !== null) {
        return -1;
      } else if (b.neededByTs !== null) {
        return 1;
      }

      if (a.createdAtTs !== null && b.createdAtTs !== null) {
        if (a.createdAtTs !== b.createdAtTs) return b.createdAtTs - a.createdAtTs;
      } else if (a.createdAtTs !== null) {
        return -1;
      } else if (b.createdAtTs !== null) {
        return 1;
      }

      return a.index - b.index;
    })
    .map(entry => entry.indent);
}
