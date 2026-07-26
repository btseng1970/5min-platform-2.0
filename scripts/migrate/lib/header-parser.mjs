// Parses the leading `-- key: value` header block from a migration file's
// content, and independently locates the Up/Down markers anywhere in the
// file. Never throws on malformed input — always returns diagnostics.

import { HEADER_FIELDS, UP_MARKER, DOWN_MARKER } from "./constants.mjs";

// Scans the leading run of header-shaped lines. Stops once all four fields
// have been collected and a non-header-shaped line is reached, or once the
// Up marker is reached. A colon-less "--" line is only a parse failure while
// fields are still missing; once all four are collected it is treated as
// ordinary body commentary (matching migrations/template.sql's own shape).
export function parseHeaderFields(lines) {
  const fields = {};
  const diagnostics = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();

    if (trimmed === UP_MARKER) {
      break;
    }
    if (trimmed.trim() === "") {
      continue;
    }
    if (!trimmed.startsWith("--")) {
      break;
    }

    const commentBody = trimmed.slice(2);
    const colonIndex = commentBody.indexOf(":");

    if (colonIndex === -1) {
      if (Object.keys(fields).length < HEADER_FIELDS.length) {
        diagnostics.push({
          code: "MIG008_HEADER_PARSE_FAILURE",
          line: i + 1,
          message: `header line has no ":" separator: "${trimmed}"`,
        });
        continue;
      }
      break;
    }

    const key = commentBody.slice(0, colonIndex).trim();
    const value = commentBody.slice(colonIndex + 1).trim();

    if (!HEADER_FIELDS.includes(key)) {
      if (Object.keys(fields).length < HEADER_FIELDS.length) {
        diagnostics.push({
          code: "MIG010_UNKNOWN_HEADER_FIELD",
          line: i + 1,
          message: `unknown header field "${key}"`,
        });
        continue;
      }
      break;
    }

    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      diagnostics.push({
        code: "MIG009_DUPLICATE_HEADER_FIELD",
        line: i + 1,
        message: `duplicate header field "${key}"`,
      });
      continue;
    }

    fields[key] = { value, line: i + 1 };
  }

  return { fields, diagnostics };
}

// Independently locates the first exact-match occurrence of each marker,
// anywhere in the file, regardless of header-field parsing state.
export function findMarkers(lines) {
  let upMarkerLine = -1;
  let downMarkerLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();
    if (upMarkerLine === -1 && trimmed === UP_MARKER) {
      upMarkerLine = i;
    }
    if (downMarkerLine === -1 && trimmed === DOWN_MARKER) {
      downMarkerLine = i;
    }
  }

  return { upMarkerLine, downMarkerLine };
}
