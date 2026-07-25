// Negative fixture: a non-.sql file present in migrations/. node-pg-migrate's
// own loader would attempt to import() any non-.sql file it finds here,
// which is exactly why Control A's validator rejects this file outright.
export const shouldNeverBeLoaded = true;
