// Scans and classifies entries under a target "migrations"-shaped directory.
// Top-level only, no recursion. Classification never follows a symlink.

import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  FILENAME_REGEX,
  README_FILENAME,
  TEMPLATE_FILENAME,
} from "./constants.mjs";

function isSemanticallyValidTimestamp(digits) {
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const second = Number(digits.slice(12, 14));
  return (
    year >= 1000 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

// Returns { timestampPrefix, slug } if name matches the filename grammar
// (including semantic timestamp validity), otherwise null.
export function parseMigrationFilename(name) {
  const match = FILENAME_REGEX.exec(name);
  if (!match) return null;
  const [, timestampPrefix, slug] = match;
  if (!isSemanticallyValidTimestamp(timestampPrefix)) return null;
  return { timestampPrefix, slug };
}

// Classifies a single directory entry without following any symlink.
// Returns one of: "symlink" | "hidden" | "directory" | "readme" | "template"
// | "migration" | "other". For "migration", also returns timestampPrefix/slug.
export function classifyEntry(dirPath, name) {
  const fullPath = join(dirPath, name);
  const stat = lstatSync(fullPath);

  if (stat.isSymbolicLink()) {
    return { name, fullPath, type: "symlink" };
  }
  if (name.startsWith(".")) {
    return { name, fullPath, type: "hidden" };
  }
  if (stat.isDirectory()) {
    return { name, fullPath, type: "directory" };
  }
  if (name === README_FILENAME) {
    return { name, fullPath, type: "readme" };
  }
  if (name === TEMPLATE_FILENAME) {
    return { name, fullPath, type: "template" };
  }
  if (name.endsWith(".sql")) {
    const parsed = parseMigrationFilename(name);
    if (parsed) {
      return {
        name,
        fullPath,
        type: "migration",
        timestampPrefix: parsed.timestampPrefix,
        slug: parsed.slug,
      };
    }
    // Ends in .sql (clearly intended as a migration) but fails the grammar —
    // distinct from "other" so it maps to MIG005 (invalid filename), not
    // MIG004 (unexpected file).
    return { name, fullPath, type: "invalid-migration-filename" };
  }
  return { name, fullPath, type: "other" };
}

// Scans a directory's top-level entries only, classifies each, and returns
// the result sorted by name (lexicographic sort of a fixed-width timestamp
// prefix is equivalent to chronological order).
export function scanDirectory(dirPath) {
  const names = readdirSync(dirPath).sort();
  return names.map((name) => classifyEntry(dirPath, name));
}
