\# 5min Coffee Platform 2.0 — Agent 憲法

\#\# 技術棧（ADR-000，不得替換）  
TypeScript / Node.js LTS / NestJS / Next.js / PostgreSQL 16 /  
pg-boss / SQL-first migrations（禁 ORM 自動生成 DDL）

\#\# 硬規則（GA Block，每個任務都適用）  
\- 金額與點數用整數最小單位，全面禁止 float/double  
\- 所有時間比較用 UTC，禁止 local timezone 運算  
\- 不得引用文件中標註 SUPERSEDED 的段落  
\- 跨 schema 禁止寫入（outbox 除外）  
\- Phase 1 禁止 Redis/memory TokenSource，抽獎用 DB SKIP LOCKED  
\- 每個任務必須附測試；測試紅燈時不得弱化測試來過關  
\- 不確定時停下來問我，不得自行發明架構決策  
\- 一次只做一個 task，改動保持小

\#\# 上游文件  
規格在 docs/ 目錄，衝突時以 codex-spec-revb1.md 為準  
