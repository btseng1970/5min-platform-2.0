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

\#\# Project File Change Inspection  
\- 盤點專案檔案變更時，一律使用：  
\`\`\`bash  
  git status \-\-short  
  git diff \-\-name\-status  
\`\`\`  
\- 禁止用 find / ls \-R 全盤掃描專案（會被 node\_modules 與 build  
  輸出淹沒，且無法區分 tracked / untracked 狀態）  
\- 需要完整追蹤清單時用 git ls\-files

\#\# Toolchain Boundary  

\- 專案程式碼、依賴、測試與持久化腳本，一律使用 ADR\-000 核准技術棧：  
  TypeScript / Node.js / NestJS / Next.js / PostgreSQL 16 / pg\-boss / SQL\-first migrations。  
\- 專案依賴與 import 必須符合 GA\-013 dependency allowlist；不得自行引入未核准的 framework、ORM、DB client、queue client 或執行工具。  
\- 一次性本地驗證命令，例如 JSON、YAML、格式或語法檢查，可以使用系統已安裝的 \`python3\`、\`ruby\` 或其他系統內建工具，但必須同時符合：  
  \- 僅執行唯讀驗證。  
  \- 不安裝任何套件。  
  \- 不修改專案檔案。  
  \- 不寫入 lockfile、cache、build output 或 dependency tree。  
  \- 不連線或修改正式環境及正式資料。  
\- 禁止使用 \`npx \-\-yes\`、\`pip install\`、\`gem install\`、\`brew install\` 或類似方式，即時下載並執行未經 ADR\-000 核准的套件。  
\- 若系統內建工具不足以完成驗證，Agent 必須停止並提出 clarification note，不得自行安裝替代工具。

\#\# Commit Gate（Human Review Before Commit）  
\- 任何 task 的 commit 必須在 Human Review 驗收通過之後，不得先行提交。  
\- Agent 完成實作後，須先提供驗證步驟清單與 Acceptance Criteria 對照表，等待 Human Review 明確確認通過，才可執行 git commit。  
\- 治理文件（如 ADR、task package 本身）的 commit 不在此限，其驗收方式為文件內容審核通過即可提交；此規則適用對象為 task 的\*\*實作\*\*（程式碼、環境設定、腳本等）。
