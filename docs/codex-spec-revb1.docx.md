**5min coffee**

**Codex Development Specification**  
*v1.0 RevB.1｜Day-0 Release Candidate Errata｜AI Coding Agent 施工規格*

| 項目 | 內容 |
| :---- | :---- |
| 文件版本 | Codex Development Spec v1.0 RevB.1｜Day-0 Release Candidate Errata |
| 文件日期 | 2026 年 7 月 |
| 上游契約 | PRD v1.1 Rev D（Frozen）→ SAD v1.0 RevC.1（Baseline）→ TDS v1.0 RevB Final Errata2（Codex Release Approved） |
| 基礎文件 | Codex Development Spec v1.0 RevA（Senior Full-stack Developer Review 後修訂） |
| 主要讀者 | Tech Lead、PM、Backend / Frontend / Data Engineer、Codex / AI Coding Agent、DevOps、QA |
| 本版目的 | RevB.1 Errata：修正 Reward gate、補回 QR / Compliance prompts、將 Start-Today 表定位為 digest 並要求 repo 內完整 16 欄 package、補 Fix Matrix M5、補 COM-008 probe 隔離與 contract-first API task 規則。 |

## **Revision History**

| 版本 | 變更摘要 | 狀態 |
| :---- | :---- | :---- |
| Codex Spec v1.0 | Epic 目錄、Task ID 慣例、GA-001\~012 工程斷言、CI fitness functions、Prompt Library、R0-R5 閘門、Seed 策略、G0 清單。 | 已併入 |
| Codex Spec v1.0 RevA | 新增 ADR-000、Commerce Integration Epic、Frontend Epic、Start-Today packages，補 Day-0 阻斷項與依賴圖修訂。 | 已併入 |
| Codex Spec v1.0 RevB | Day-0 Release Candidate：① 完整展開 GA-001\~015；② 補齊 campaign/ip\_asset/analytics schema；③ ADR-000 執行狀態與開工閘門；④ 補 NOT-000 / COM-008 完整 Task Package；⑤ 裁定 Phase 1 runtime DB enforcement strategy；⑥ 補 Admin Epic、/api/v1/me freshness、contract-first OpenAPI、outbox/pg-boss 邊界。 | 已併入 |
| Codex Spec v1.0 RevB.1 | Day-0 Release Candidate Errata：① Reward 開發 gate 改為 G-WAL \+ G-QR，G-COM 移為 Pilot Run/Production activation 前置；② 補回 QR / Compliance prompt；③ 第 15 章定位為 digest，完整 16 欄 package 必須 commit 至 docs/codex-task-packages；④ Fix Matrix 補 M5；⑤ COM-008 probe 隔離與 OpenAPI task-first 規則。 | 本版 |

# **0｜Source-of-Truth Hierarchy**

* Codex tasks 以 TDS v1.0 RevB Final Errata2 為直接工程契約；與 PRD/SAD/舊 TDS 章節衝突時，以 TDS Errata2 與本 Codex Spec RevB 為準。  
* ADR-000 為技術棧唯一決策紀錄；任何語言、框架、資料庫、queue、migration 工具選擇一律引用 ADR-000。  
* 標註 SUPERSEDED 的段落不得作為 DDL、API、測試或業務邏輯的生成依據；任何 task package 引用 SUPERSEDED 段落，CI docs lint 必須 fail。  
* 實作不確定時，Codex 必須停止並建立 clarification note，不得發明架構或自行選型。

Non-negotiable Codex Rule  
Human readers can follow priority chains. AI agents retrieve context by chunk.  
Every task prompt must restate the relevant hard rules: Full GA block \+ ADR-000 stack \+ Active TDS sections.  
Do not depend on the agent remembering earlier chat context or older documents.

# **1｜Executive Summary**

* 目標：把已凍結 TDS 轉為小型、可審查、可測試、可交付 Codex 的實作任務。  
* Phase 1 Reward 採 DB-backed token \+ SELECT ... FOR UPDATE SKIP LOCKED；禁止 Redis/memory TokenSource。  
* Wallet 為 append-only ledger \+ point\_lot \+ FIFO \+ negative ledger；禁止餘額覆寫，兌換授權以 lots 聚合為唯一依據。  
* 全 UTC 時間比較；金額/點數/合規值使用整數最小單位或核准高精度；禁 float/double。  
* RevB 修訂開工順序：G0 / NOT-000 / COM-008 可先行；FND-000 onward 需 ADR-000 Accepted；Foundation 後 Wallet \+ Commerce \+ Compliance 並行；Reward 不早於 Foundation、Wallet、QR 基礎測試通過。

# **2｜ADR-000：Technology Stack Decision**

**狀態裁定：Accepted for Day-0 Release Candidate。Repo 內仍需保留 Tech Lead 簽核紀錄作為 G-ADR gate evidence；若簽核紀錄不存在，FND-000 onward 不得進入 merge。**

| 決策項 | RevB 決定 | 理由 | 被否決替代方案 |
| :---- | :---- | :---- | :---- |
| 語言 / Runtime | TypeScript（Node.js LTS）全端統一 | 單一語言覆蓋 BFF/worker/前端，AI Agent 生成品質與生態成熟；團隊規模不支撐雙語言棧。 | Kotlin/Spring、Go |
| 後端框架 | NestJS | module/package 邊界與 Modular Monolith 對齊；DI 與 import lint 易執法。 | Express 裸奔、tRPC-only |
| 資料庫 | PostgreSQL 16 | SKIP LOCKED、partial unique index、宣告式分區、DETACH PARTITION 原生支援。 | MySQL、雲廠商專有庫 |
| Migration 工具 | SQL-first migration（dbmate / node-pg-migrate 類），禁止 ORM 自動生成 DDL | 分區表、partial index、owning\_context header 需手寫 SQL 完整控制。 | Prisma migrate / ORM schema sync |
| ORM / Data Access | Kysely 類 query builder \+ 手寫 SQL for ledger/draw 交易 | 帳本與抽獎交易需逐句可審；重 ORM lazy loading 與隱式 cache 為稽核風險。 | TypeORM/Prisma Client 全面使用 |
| Queue | PostgreSQL-based job queue（pg-boss 類） | 容量模型峰值 5-50 QPS；單一基礎設施可滿足 outbox relay、worker、DLQ、分區保序。 | Kafka/RabbitMQ/Redis/BullMQ |
| 前端框架 | Next.js（storefront/member center/admin shell）＋ LINE LIFF SDK | SSR/OG meta 動態化與 LIFF 綁定符合 PRD 主路徑。 | SPA-only |
| 部署基線 | Docker \+ single-region managed PostgreSQL；K8s 非 Phase 1 必要 | Phase 1 量級不需 K8s；先求可重現環境與可觀測。 | Serverless-first |

## **2.1｜ADR-000 Sign-off and Gate Control**

| Gate 狀態 | Allowed Before Accepted | Forbidden Before Accepted | Required Evidence |
| :---- | :---- | :---- | :---- |
| G-ADR not yet evidenced | G0-001\~003、NOT-000、COM-008 | FND-000 onward、任何 DDL / repo bootstrap / dependency install | Tech Lead sign-off record in docs/adr/ADR-000.md |
| G-ADR evidenced | FND-000\~006、FND-007\~013、Wallet/Commerce/Compliance after G-FND | 任何非 ADR-000 allowlist 依賴；任何 memory TokenSource | CI dependency allowlist \+ ADR-000 Accepted row |

* GA-013：所有依賴與 import 必須落在 ADR-000 核准清單內；CI 以 dependency allowlist 執法。  
* 任何棧內替換（例如更換 queue 實作）需開 ADR-000.x，不得在 task 層偷換。

# **3｜Repository and Schema Ownership**

repo/  
 apps/  
  web/      \# Next.js storefront \+ member center \+ LIFF  
  admin/    \# Next.js admin / CMS / dashboard shell  
  api/      \# NestJS BFF / API gateway  
  worker/   \# outbox relay, pg-boss consumers, settlement, reconciliation  
 packages/  
  domain/ campaign | wallet | qr | reward | notification | compliance | crm | team | ip\_asset | analytics | commerce  
  shared/ event-envelope | errors | money | time | test-fixtures | api-contract  
  infrastructure/ db | outbox | queues(pg-boss) | observability  
 migrations/ platform | campaign | wallet | qr | reward | notification | compliance | crm | team | ip\_asset | analytics | commerce  
 docs/ codex-task-packages | adr | runbooks | openapi

| Schema | Owner Module | Writes Allowed By | Public Read Contract |
| :---- | :---- | :---- | :---- |
| platform.\* | Infrastructure / Platform | platform infra only | platform\_public.event\_status, platform\_public.outbox\_health |
| campaign.\* | Campaign | Campaign only | campaign\_public.campaign\_summary |
| wallet.\* | Wallet | Wallet only | wallet\_public.wallet\_summary, wallet\_public.negative\_status |
| qr.\* | QR | QR only | qr\_public.scan\_summary |
| reward.\* | Reward | Reward only | reward\_public.pool\_summary, reward\_public.draw\_status |
| notification.\* | Notification Broker | Notification only | notification\_public.preference\_summary |
| compliance.\* | Compliance | Compliance only | compliance\_public.policy\_summary |
| crm.\* | CRM / Member Tier | CRM only | crm\_public.member\_profile\_read, crm\_public.tier\_display |
| team.\* | Team | Team only | team\_public.team\_summary |
| ip\_asset.\* | IP Asset Policy | IP Asset only | ip\_asset\_public.asset\_policy\_summary |
| analytics.\* | Analytics / Dashboard | Analytics only | analytics\_public.metric\_summary |
| commerce.\* | Commerce Integration | Commerce only | commerce\_public.order\_summary, commerce\_public.sku\_margin\_view |

**RevB 裁決：補齊 campaign.\*, ip\_asset.\*, analytics.\* schema。FND-004 建立 platform \+ 11 domain schemas，合計 12 schemas。**

## **3.1｜Runtime DB Enforcement Strategy**

| 層級 | RevB 裁決 | 原因 | Codex / CI 要求 |
| :---- | :---- | :---- | :---- |
| Runtime DB connection | Phase 1 採單一非 superuser app\_rw\_user；不採 module-scoped DB pools。 | 避免早期 modular monolith 引入過多 connection role / pool complexity。 | app\_rw\_user 不得是 DB owner/superuser；危險 DDL 僅 migration role 可執行。 |
| Write isolation enforcement | 以 repository ownership \+ static SQL scanner \+ migration owning\_context \+ human review 為主。 | 可在不增加 runtime DB role 複雜度下維持 service-ready boundaries。 | 跨 context INSERT/UPDATE/DELETE 非 platform.event\_outbox 一律 CI fail。 |
| DB role test | 保留 per-context DB role grant 作為 migration-level proof，不宣稱 runtime 全面 enforce。 | 防止文件誤導，並為未來服務化預留。 | FND-004 測試仍需證明 wallet role 無法寫 reward.\*。 |
| Future extraction | 若某 context 拆服務，再以 ADR-000.x 啟用 module-scoped DB user / pool。 | 逐步演進。 | 需新增 ADR 與 migration plan。 |

# **4｜Full Global Engineering Assertions（GA-001\~015）**

| Assertion | Rule | Codex Meaning | CI / Test Gate |
| :---- | :---- | :---- | :---- |
| GA-001 | No Float / Double | wallet、reward、compliance、money、points、probability、EV、breakage、legal threshold 相關 code、DDL、註解均不得出現 float/double；唯一例外為 CI negative test fixture。 | no-float scanner P0 fail。 |
| GA-002 | UTC Only / Midnight Crux | 所有 expires\_at / accounting / expiry SQL 必須使用 UTC timestamp；Point Expiry Job 以 DB server UTC 原子比對，禁止 application local timezone 運算。 | UTC lint \+ TW/JP midnight boundary tests。 |
| GA-003 | No SUPERSEDED Context | Codex task 不得引用標註 SUPERSEDED 之段落；若 active section 與舊段落衝突，以 active TDS Errata2 與本 RevB 為準。 | docs lint fail。 |
| GA-004 | DB-backed Token Only in Phase 1 | Reward Phase 1 採 PostgreSQL prize\_token \+ SELECT ... FOR UPDATE SKIP LOCKED；禁止 Redis/memory TokenSource。 | dependency allowlist \+ code scan。 |
| GA-005 | DrawReserved-time Result | 抽獎結果在 DrawReserved ACID transaction 中決定；Worker settlement 僅執行，不重新擲骰、不改判。 | reward transaction tests。 |
| GA-006 | Idempotency Returns Existing Result | business\_idempotency\_key unique violation 必須 catch 後查既有 draw 回傳；不得 500、不得重抽。 | concurrent idempotency test。 |
| GA-007 | QR Code Atomic Enforcement | 一碼一用唯一執法點是 qr.code 原子狀態轉移；scan\_event 僅為分區事實表。ALREADY\_USED / INACTIVE 失敗掃描需 rollback 後獨立交易落庫。 | QR concurrency \+ E1 test。 |
| GA-008 | Partition Key in PK/Unique | qr.scan\_event、platform.event\_outbox、notification.send\_history 等高量分區表之 PK / unique index 必須包含分區鍵時間欄位。 | DDL partition check。 |
| GA-009 | Wallet Lot is Authorization Truth | 兌換/扣點/checkout 權益授權不得用 stale balance projection；必須交易內聚合 active point\_lot / locked lots。禁止直接覆寫 balance。 | wallet strong read tests。 |
| GA-010 | Negative Ledger Freezes Checkout Tier | NegativeLedgerOpened/Cleared 事件由 Wallet 發布；CRM-006 使 member\_tier\_checkout 進 FROZEN，checkout discount\_rate=1.00，負帳清零後恢復。 | E2E freeze propagation test。 |
| GA-011 | Broker Only | LINE / Email / SMS 只能由 Notification Broker 呼叫 provider；任何 module 直連 vendor API 均 fail。 | vendor access lint。 |
| GA-012 | TWD / JPY Integer Minor Units | TWD 與 JPY 均以整數最小貨幣單位儲存；不得在 money 欄位使用 Decimal(18,4) 的 or 表述。Probability 可使用核准 high-precision value object。 | DDL scanner \+ unit tests。 |
| GA-013 | ADR-000 Dependency Allowlist | 所有依賴與 import 必須落在 ADR-000 核准棧內；不得引入未核准 DB client、queue client、ORM 或框架。 | dependency allowlist scan。 |
| GA-014 | Commerce Canonical Order Events | OrderCompleted / ReturnCompleted 只能由 Commerce Integration module 產生；其他模組不得自行合成訂單事件。 | event producer ownership test。 |
| GA-015 | Frontend via BFF / OpenAPI Only | Frontend 不得直接呼叫 domain module；只能經 BFF API 與 docs/openapi contract 生成 client。 | FE import lint \+ contract tests。 |

**Every task prompt must paste the Full GA Block or explicitly reference docs/codex-task-packages/\_full-ga-block.md generated from this section. “沿用 v1.0” is forbidden in task prompts.**

# **5｜CI/CD and Architecture Fitness Functions**

| Guardrail | Scope | Fail Condition | Owner |
| :---- | :---- | :---- | :---- |
| no-float scanner | packages/domain/{wallet,reward,compliance}, migrations | float/double token outside negative fixtures | Tech Lead |
| schema write isolation | all SQL and repositories | INSERT/UPDATE/DELETE to non-owning schema except platform.event\_outbox | Tech Lead |
| cross-schema read control | all SQL | SELECT from non-public schema outside owning context without waiver | Tech Lead |
| superseded lint | docs/codex-task-packages | references to SUPERSEDED sections | Tech Lead |
| UTC lint | expiry/accounting paths | LocalDateTime, Asia/Taipei, Asia/Tokyo, local timezone math | Tech Lead |
| partition DDL check | high-volume tables | partitioned table unique index missing partition key | DB reviewer |
| vendor access lint | all modules | LINE/Email/SMS vendor SDK import outside notification module | Tech Lead |
| dependency allowlist | package manager lockfile / imports | dependency outside ADR-000 allowlist | DevOps |
| OpenAPI contract validation | apps/api and apps/web/admin | route diverges from docs/openapi contract | Full-stack Lead |

# **6｜OpenAPI, BFF, and /api/v1/me Freshness Contract**

**RevB 裁決：OpenAPI is contract-first。docs/openapi 是 API 契約真相；NestJS route implementation must conform to docs/openapi。由 code 生成之 OpenAPI 僅作驗證輸出，不是 source of truth。**

RevB.1 API task rule：每個 epic 的 API task 必須先修改 docs/openapi 路徑定義與 request/response/error schema，再實作 NestJS route。PR 內若 route implementation 先於 OpenAPI contract 或不符合 contract validation，CI 必須 fail。

| Endpoint / Data Block | Consistency | Cache / Freshness | Pricing Authority |
| :---- | :---- | :---- | :---- |
| /api/v1/me: tier\_display | bounded-stale display projection | BFF cache TTL 30-60s；response includes data\_freshness\_at | No. Checkout pricing must use member\_tier\_checkout strong path. |
| /api/v1/me: wallet display balance | bounded-stale display projection | BFF cache TTL 30-60s；show data\_freshness\_at | No. Redeem/claim/debit path must aggregate active lots transactionally. |
| /api/v1/me: collection/team summary | eventual / near-real-time | BFF cache TTL 30-60s; label as estimated where needed | No. |
| /api/v1/checkout/pricing | strong consistent | No cache | Yes; reads member\_tier\_checkout \+ negative ledger freeze flag. |
| /api/v1/qr/pending-grants/{id}/claim | strong consistent | No cache; requires claim token/session \+ risk checks | No pricing; grants asset only after domain validation. |
| /api/v1/redeem | strong consistent | No cache | Yes for wallet debit authorization. |

# **7｜Task Package Standard and ID Convention**

Package 模板欄位：Task ID / Objective / Source of Truth / Active TDS Sections / Superseded to Ignore / Allowed & Forbidden Files / DB & API Changes / Domain Events / Full GA Block / Implementation Steps / Acceptance Criteria / Tests Required / Seed Data / Observability / Rollback / Human Review。

| Prefix | Epic | Examples |
| :---- | :---- | :---- |
| FND | Foundation | FND-000 dev environment、FND-013 OpenAPI contract source |
| COM | Commerce Integration | COM-001 webhook ingestion、COM-008 constraints audit |
| WAL | Wallet | WAL-001 point\_lot、WAL-009 negative ledger events |
| QR | QR | QR-004 atomic scan、QR-006 PendingGrant |
| REW | Reward | REW-004 DrawReserved ACID transaction |
| NOT | Notification | NOT-000 LINE sandbox、NOT-003 preferences |
| CMP | Compliance | CMP-003 JP general premium rule |
| CRM | CRM / Member Tier | CRM-006 negative ledger checkout freeze |
| TEAM | Team | TEAM-004 clawback |
| IP | IP Asset | IP-003 asset policy evaluation |
| ADM | Admin / CMS | ADM-005 compliance approval queue |
| FE | Frontend | FE-002 scan-to-draw animation |
| G0 | Cutover | G0-001 member inventory |

# **8｜Epic Roadmap and Dependency Graph**

G0 Data Cleaning || NOT-000 || COM-008  (allowed before ADR-000 Accepted)  
ADR-000 Accepted \-\> FND-000\~013  
G-FND \-\> Wallet || Commerce Integration || Compliance schema || FE-001 contract shell  
G-WAL \+ G-QR \-\> Reward development  
G-COM \-\> Team vesting / CRM tier accumulation / QR-009 production activation / Pilot Run readiness  
G-REW \-\> Notification \-\> CRM/Team \-\> FE full integration  
Admin/IP Asset/Dashboard \-\> G0 Cutover \-\> Pilot Run

| Gate | Exit Criteria | Unlocks |
| :---- | :---- | :---- |
| G-ADR | ADR-000 Accepted evidence in docs/adr/ADR-000.md | FND-000 onward |
| G-FND | Repo, migrations, all 12 schemas, event\_outbox partition, CI guardrails, devcontainer, OpenAPI contract validation pass | Wallet, Commerce, QR, Compliance schema, FE-001 |
| G-WAL | Point lot, ledger, FIFO, expiry, negative ledger events, reconciliation tests pass | QR point grants, Reward wallet posting, FE wallet display |
| G-COM | Webhook dedupe/replay, canonical events, SKU margin mapping, shipment feed pass | Team vesting, CRM tier accumulation, QR B2C production activation, Pilot Run readiness |
| G-QR | Signature verification, qr.code atomic transition, E1 failure event independent transaction, PendingGrant claim security pass | Reward development（with G-WAL completed）；Reward anonymous draw |
| G-REW | DB-backed token concurrency, idempotency, pity migration, anonymous draw, oversell tests pass | FE-002 full integration, gacha pilot |
| G-NOT/CMP | Broker-only and compliance publish gate P0 flows pass | Campaign operations |
| G-CRM/TEAM | Tier migration, health score, negative ledger freeze, vesting/clawback pass | Member center complete, team pilot |
| G-FE | Scan→draw→collection E2E, LIFF binding, checkout display pass | Pilot Run |
| G0 | Data cleaning, migration dry-run, legacy QR decision, rollback plan complete | Pilot Run / gray release |

# **9｜Foundation Epic（RevB）**

| Task ID | Title | Acceptance Criteria | Tests |
| :---- | :---- | :---- | :---- |
| FND-000 | Dev environment & CI infra | devcontainer/docker-compose: PG16, pg-boss, test DB provisioning; CI can run migration validation and integration tests. | environment smoke test |
| FND-001 | Repository bootstrap | ADR-000 monorepo skeleton; apps/api/web/admin/worker can start. | smoke \+ lint |
| FND-002 | Module package boundaries | 11 domain packages established; cross-module import forbidden except shared contracts. | architecture import test |
| FND-003 | DB migration framework | SQL-first migrations with owning\_context and rollback/forward-fix notes. | migration validation |
| FND-004 | Schema isolation | Create platform \+ 11 domain schemas: campaign, wallet, qr, reward, crm, team, notification, compliance, commerce, ip\_asset, analytics. | schema ownership test |
| FND-005 | Event outbox base | platform.event\_outbox monthly partitioned; partition key in PK/unique; event source-of-truth separated from pg-boss delivery. | DDL partition \+ outbox write tests |
| FND-006 | CI guardrails | no-float, schema write, superseded, UTC, dependency allowlist, OpenAPI validation scanners enabled. | CI negative tests |
| FND-007 | Shared value objects | Money/Points/Probability/UtcTimestamp; no primitive float/double. | boundary unit tests |
| FND-008 | Error model | canonical error codes including DRAW\_PAUSED=503, RATE\_LIMITED=429. | API error tests |
| FND-009 | Test fixture framework | member/campaign/qr/wallet/reward/market seed builders. | fixture tests |
| FND-010 | Observability base | correlation\_id API→domain→outbox. | trace integration test |
| FND-011 | RBAC shell | admin roles and maker/checker permission skeleton. | permission unit tests |
| FND-012 | Docs lint | docs lint validates no SUPERSEDED references and verifies every docs/codex-task-packages/\*.md contains the required 16 sections. Missing fields fail CI. | docs lint test |
| FND-013 | OpenAPI contract source | docs/openapi is contract source of truth; BFF route validates against spec; FE client generated. | contract validation |

## **9.1｜FND-005 Outbox / pg-boss Boundary**

| Component | Role | Not Allowed | Reconciliation |
| :---- | :---- | :---- | :---- |
| platform.event\_outbox | Domain event source of truth, inserted in same DB transaction as domain mutation. | Not a worker execution engine. | status, retry\_count, published\_at\_utc updated by relay. |
| pg-boss / job queue | Delivery/execution queue for outbox relay, workers, delayed jobs, DLQ-like handling. | Not source of domain truth. | Jobs reference event\_id; missing job can be rebuilt from outbox. |
| Outbox relay worker | Reads NEW/RETRY outbox rows, enqueues pg-boss jobs, marks PUBLISHED or RETRY. | Must not generate new domain facts. | Relay lag and oldest\_unpublished\_age in Platform Health. |

# **10｜Commerce Integration Epic**

OrderCompleted / ReturnCompleted canonical events are the only order event source（GA-014）。Commerce Integration 是 Wallet 橋接、Team vesting、CRM tier、QR B2C activation 的事件源。

| Task ID | Title | Acceptance Criteria | Tests |
| :---- | :---- | :---- | :---- |
| COM-001 | Legacy webhook ingestion | Raw payload preserved in platform.raw\_webhook\_event; provider\_event\_id dedupe. | replay/dedupe tests |
| COM-002 | commerce schema | commerce.order\_snapshot, order\_line, sku\_master(gross\_margin\_band, bridge\_weight). | DDL tests |
| COM-003 | SKU margin mapping | Unmapped SKU enters review queue; never default bridge\_weight. | mapping tests |
| COM-004 | Canonical OrderCompleted | raw→canonical event; partition key=order\_id; replay does not duplicate. | idempotency tests |
| COM-005 | Canonical ReturnCompleted | refund/chargeback canonical event with original\_order reference. | reversal chain tests |
| COM-006 | Shipment/activation feed | order/shipment event feeds QR-009 B2C activation. | integration tests |
| COM-007 | Checkout tier integration | legacy checkout reads member\_tier\_checkout strong projection and negative ledger flag via stub. | contract tests |
| COM-008 | Legacy constraints audit | Provider-specific payload, retry, signature, refund/shipment lifecycle, SKU/member mapping, provider\_event\_id uniqueness documented. | audit report |

# **11｜Frontend Epic**

**Frontend is in Codex scope. FE uses Next.js apps/web and apps/admin shell, generated OpenAPI client only（GA-015）. FE-001 unlocks after G-FND \+ FND-013, not after G-WAL.**

| Task ID | Title | Acceptance Criteria | Tests |
| :---- | :---- | :---- | :---- |
| FE-001 | Web app shell \+ API client | Next.js shell, generated OpenAPI client, auth session, error mapping for 429/503. Unlock: G-FND \+ FND-013. | E2E smoke |
| FE-002 | 掃碼→開獎流程（P0） | Scan page → draw request → DrawReserved result animation → settlement polling → PrizeGranted confirmed; anonymous to PendingGrant funnel. | E2E \+ failure states |
| FE-003 | LIFF binding flow | LINE LIFF binding; pending grant claim session reference; no plaintext token. | LIFF integration tests |
| FE-004 | Member center | /api/v1/me display blocks with data\_freshness\_at; tier display not pricing authority. | component \+ contract |
| FE-005 | IP landing page | Campaign landing, countdown, SKU grid, dynamic SSR/OG. | SSR/OG tests |
| FE-006 | Collection UI | Unlocked/silhouette/generic placeholder by asset policy response. | render tests |
| FE-007 | Probability disclosure | disclosure\_version matches backend probability\_version. | contract tests |
| FE-008 | Checkout discount display | Shows effective discount and negative ledger freeze explanation; pricing uses strong checkout API. | integration tests |
| FE-009 | Admin war-room view | Campaign war room: sell-out, scan heat, pool progress. | dashboard tests |
| FE-010 | Preference Center | message preferences with market\_id awareness. | form \+ consent tests |

# **12｜Admin / CMS Epic（RevB 新增）**

Admin app exists in repo and ADR-000. RevB adds ADM catalog to avoid config / maker-checker / audit becoming hidden manual SQL. Phase 1 can start with read-only \+ approval queues; write operations require RBAC and audit.

| Task ID | Title | Acceptance Criteria | Tests |
| :---- | :---- | :---- | :---- |
| ADM-001 | Admin shell \+ RBAC | Next.js admin shell, login placeholder, RBAC routes, maker/checker UI skeleton. | permission route tests |
| ADM-002 | Campaign config read-only | Campaign list/detail read-only from campaign\_public views; no direct DB write. | contract tests |
| ADM-003 | QR batch admin | QR batch status, activation events, revoke action stub with maker/checker. | RBAC \+ audit tests |
| ADM-004 | Reward pool admin | Prize pool/probability display, no direct winner assignment, audit view. | restriction tests |
| ADM-005 | Compliance approval queue | MarketCompliancePolicy changes with Legal \+ Business dual approval. | maker-checker tests |
| ADM-006 | Audit log viewer | Search audit by correlation\_id/operator\_id/member\_id. | query tests |

# **13｜Wallet / QR / Reward / Notification / Compliance / CRM+Team Delta**

| Delta | 修訂內容 |
| :---- | :---- |
| WAL-009 | Wallet 發布 NegativeLedgerOpened / Cleared 事件；不觸碰 crm.\*。 |
| CRM-006 | 負帳凍結 checkout benefit 唯一實作點：事件訂閱 → member\_tier\_checkout.tier\_benefit\_status=FROZEN → checkout 折扣 1.00 → Cleared 恢復。 |
| NOT-000 | LINE Official Account sandbox / test channel 申請與憑證管理。Secrets 不進 repo；使用 .env.example \+ secret manager stub。 |
| CRM-003 | 依賴 G0-004 級距映射與 COM 歷史訂單 margin 標記；grandfathering\_until 寫入 checkout projection。 |
| TEAM-002/004 | 依賴 G-COM，Confirmed/Reversed by canonical order events。 |

# **14｜G0 Cutover and Seed Data**

| Seed Pack | Owner | 備註 |
| :---- | :---- | :---- |
| market.seed | Legal \+ Product | JP 合規規則版本與上限數字須 Legal 確認後鎖定；工程不得自行填 JP legal numbers。 |
| member.seed / wallet.seed / qr.seed / reward.seed / team.seed | Tech Lead \+ QA | 依 fixture framework 生成；不得使用生產個資。 |
| notification.seed | CRM Owner | 頻控邊界樣本（接近 cap 的 send\_history）。 |
| legacy.seed | Data \+ Finance | 以 G0-001\~003 盤點結果為藍本，含 balance-only cases。 |

# **15｜Start-Today Task Package Digest \+ Repo Full Packages（RevB.1）**

**本章表格為 Start-Today digest，便於會議簽核與任務排序；不得直接取代第 7 章要求之 16 欄完整 task package。G-ADR 通過後，第一個文件治理動作是將完整 16 欄版本 commit 至 docs/codex-task-packages/，再交付 Codex 執行。FND-012 docs lint 必須驗證每份 package 具備：Task ID / Objective / Source of Truth / Active TDS Sections / Superseded to Ignore / Allowed & Forbidden Files / DB & API Changes / Domain Events / Full GA Block / Implementation Steps / Acceptance / Tests / Seed / Observability / Rollback / Human Review。共同 Engineering Assertions：Full GA-001\~015、ADR-000 stack、No SUPERSEDED、UTC only、No memory TokenSource、No cross-schema write、OpenAPI contract-first。**

| Task | Objective | Implementation Scope | Tests | Human Review |
| :---- | :---- | :---- | :---- | :---- |
| FND-000 | Dev environment & CI infra | Allowed: .devcontainer/\*\*, docker-compose.yml, .github/workflows/ci.yml, scripts/dev/\*\*. Build PG16 \+ pg-boss test environment; CI empty pipeline; partition capability test. | environment smoke \+ partition capability tests | Tech Lead |
| FND-001 | Repository bootstrap | Allowed: apps/\*\*, packages/shared/\*\*, workspace config. Create NestJS api, Next.js web/admin, worker app, GET /healthz. | smoke \+ lint | Tech Lead |
| FND-002 | Module package boundaries | Allowed: packages/domain/\* skeleton, tests/architecture/\*\*. Create 11 domain packages and import lint. | architecture import positive/negative tests | Tech Lead |
| FND-003 | DB migration framework | Allowed: migrations/README, template, scripts/migrate/\*\*. SQL-first migrations with owning\_context headers. | migration validation \+ up/down roundtrip | Tech Lead |
| FND-004 | Schema isolation | Allowed: migrations/platform/0001\_schemas.sql. Create platform \+ 11 schemas and role proof tests. | schema ownership tests | Tech Lead |
| FND-005 | Event outbox base | Allowed: migrations/platform/0002\_event\_outbox.sql, packages/infrastructure/outbox/\*\*. Partitioned event\_outbox; outbox writer; relay skeleton; forward-fix rollback for production. | DDL partition \+ outbox write-in-txn tests | Tech Lead \+ migration reviewer |
| FND-006 | CI guardrails | Allowed: scripts/ci/\*\*, workflows, tests/architecture/\*\*. Enable scanners for no-float, SQL, superseded, UTC, dependency, OpenAPI. | CI negative tests x6+ | Tech Lead |
| NOT-000 | LINE OA Sandbox and Credential Preparation | Allowed: docs/not/line-sandbox-request.md, .env.example, secret stub docs. Submit sandbox request; document callback URLs, test channel IDs, credential storage. No secrets in repo. | credential hygiene checklist | CRM Owner \+ Tech Lead |
| COM-008 | Legacy Commerce Constraint Audit | Allowed: docs/commerce/audit/\*\*, scripts/g0/commerce\_probe/\*\*. Capture webhook payloads, retry, signature, refund/shipment lifecycle, SKU/member mapping, provider\_event\_id uniqueness. Probe scripts run in isolated one-off environment, are not application code, are exempt from ADR-000 dependency allowlist, and must not enter app dependency tree or production CI dependencies. | audit report with samples | Tech Lead \+ Finance |
| G0-001 | Member identity inventory | Allowed: scripts/g0/member\_inventory/\*\*, docs/g0/reports/\*\*. Export isolated legacy member data, normalize hashes, conflict buckets. | dedupe unit tests | Data \+ CRM Owner |
| G0-002 | Points inventory | Allowed: scripts/g0/points\_inventory/\*\*, docs/g0/reports/\*\*. Classify legacy points by lot/expiry/balance-only, reconcile total. | classification \+ sum tests | Data \+ Finance |
| G0-003 | Point lot migration policy | Allowed: docs/g0/migration\_expiry\_policy.md, scripts/g0/lot\_migration\_dryrun/\*\*. Define balance-only migration policy options and dry-run skeleton. | fixture tests incl balance-only | Finance \+ Product \+ Tech Lead |

# **16｜Prompt Library and Release Gates**

**All prompts must start with: Technology stack is fixed by ADR-000: TypeScript/NestJS/Next.js/PostgreSQL 16/pg-boss/SQL-first migrations/Kysely. Do not introduce other frameworks, DB clients, queues, ORMs or local-time logic.**

| Prompt | Critical Rules |  |
| :---- | :---- | :---- |
| 15.1 Commerce Task Prompt | raw webhook preserved; provider\_event\_id dedupe; canonical OrderCompleted/ReturnCompleted are ONLY order events（GA-014）; unmapped SKU enters review queue; never default bridge\_weight. |  |
| 15.2 Frontend Task Prompt | consume BFF via generated OpenAPI client only（GA-015）; handle 429/503 with poll\_after\_seconds; never render plaintext claim token; tier\_display is bounded-stale and not pricing authority. |  |
| 15.3 Foundation Task Prompt | do not implement business logic; enforce boundaries first; include Full GA block and ADR-000 stack; negative tests required. |  |
| 15.4 Wallet Task Prompt | no balance overwrite; lots are authorization truth; UTC expiry by DB server; negative ledger emits events only. |  |
| 15.5 Reward Task Prompt | use DB-backed token and SKIP LOCKED; idempotency unique violation returns existing result; no memory TokenSource. |  |
| 15.6 QR Task Prompt | critical rules: qr.code atomic state transition is the one-code-one-use enforcement point; ALREADY\_USED\_OR\_INACTIVE scan\_event must be written in an independent transaction after rollback; pending\_grant claim requires claim token/session, risk checks, device/IP/member rate caps; scan\_event unique constraints are defensive only and must include partition key when partitioned; never expose plaintext claim token. |  |
| 15.7 Compliance Task Prompt | critical rules: separate General Lottery JP and General Premium JP rule domains; test JP boundary values ¥999/¥1000/¥1001; copying TW prize pool to JP must re-run JP compliance checks; no float/double; output rule\_id, input\_value, allowed\_value, rounding\_policy, calculation\_version; market.seed legal numbers require Legal \+ Product ownership. |  |
| **Gate** | **Required Evidence** | **Approver** |
| G-ADR | ADR-000 Accepted signed record. | Tech Lead |
| R0 Foundation | CI guardrails \+ schema isolation \+ outbox partition \+ devcontainer \+ OpenAPI validation. | Tech Lead |
| R1 Wallet | ledger/lot/reversal/expiry/negative-ledger-event tests \+ reconciliation samples. | Tech Lead \+ Finance |
| R1.5 Commerce | webhook dedupe/replay, canonical events, SKU margin mapping tests. | Tech Lead \+ Finance |
| R2 QR | atomic scan, E1 failure event, claim security, batch revoke. | Tech Lead \+ Security |
| R3 Reward | concurrent draw, idempotency, pity migration, anonymous draw, oversell. | Tech Lead \+ QA |
| R4 Compliance | JP boundary rules, publish gate, maker-checker. | Legal \+ Tech Lead |
| R5 Notification | Broker-only, cooldown, circuit breakers. | CRM Owner \+ Tech Lead |
| R6 Frontend | scan→draw→collection E2E, LIFF binding, checkout display. | Product Owner \+ Tech Lead |
| G0 Cutover | cleaning, dry-run, legacy QR decision, rollback plan. | PM \+ Data \+ Tech Lead |
| Pilot Run | core E2E \+ monitoring dashboard \+ pilot cohort. | CEO / Product Owner |

# **17｜RevB Fix Matrix（Senior Full-stack Review）**

| Issue | RevB Fix | Blocking Status |
| :---- | :---- | :---- |
| P0-1 GA-001\~012 only “沿用 v1.0” | Section 4 fully expands GA-001\~015 and mandates Full GA block in every task prompt. | Resolved |
| P0-2 package/schema mismatch | Section 3 and FND-004 now create platform \+ 11 domain schemas, including campaign/ip\_asset/analytics. | Resolved |
| P0-3 ADR-000 Proposed ambiguity | Section 2.1 defines G-ADR gate, allowed/forbidden tasks before evidence, and Accepted-for-RC status. | Resolved |
| P0-4 NOT-000/COM-008 missing full package | Section 15 adds both complete packages. | Resolved |
| P0-5 runtime DB role enforcement unclear | Section 3.1 chooses Phase 1 single app user \+ CI/static enforcement, DB role as proof test. | Resolved |
| M1 outbox vs pg-boss boundary | Section 9.1 clarifies outbox as domain truth and pg-boss as delivery/execution. | Added |
| M2 OpenAPI contract-first | Section 6 declares docs/openapi as contract truth and adds API task rule: update OpenAPI before route implementation. | Added |
| M3 FE-001 unlock too late | Section 11 makes FE-001 unlock after G-FND \+ FND-013. | Added |
| M4 Admin Epic missing | Section 12 adds ADM-001\~006. | Added |
| M5 Commerce provider-specific contract capture | COM-008 captures provider-specific webhook samples, retry/signature policy, refund/shipment lifecycle, SKU/member mapping, provider\_event\_id uniqueness, and raw payload retention before implementation. | Added |
| M6 /api/v1/me freshness | Section 6 adds caching and pricing authority rules. | Added |
| P1-1 Reward gate over-constrained | Section 8 changes Reward development gate to G-WAL \+ G-QR; G-COM moved to Team/CRM/QR production activation and Pilot Run readiness. | Resolved in RevB.1 |
| P1-2 QR / Compliance prompts missing | Section 16 prompt table adds QR and Compliance prompt templates with E1, claim security, rule-domain and boundary-test rules. | Resolved in RevB.1 |
| P1-3 Start-Today package digest vs full package | Section 15 marks the table as digest and requires full 16-field packages committed under docs/codex-task-packages; FND-012 validates completeness. | Resolved in RevB.1 |

# **18｜Day-0 Execution Order**

* Today before G-ADR: NOT-000、COM-008、G0-001\~003 may start because they do not install dependencies or create application code.  
* G-ADR: complete ADR-000 signing and record docs/adr/ADR-000.md. Without this evidence, FND-000 onward cannot merge.  
* After G-ADR: execute FND-000\~006 in order. FND-007\~013 follow immediately after guardrails are active.  
* After G-FND: Wallet and Commerce Integration start in parallel; Compliance schema can also proceed.  
* Reward development gate \= G-WAL \+ G-QR. G-COM is not required for Reward engine development; G-COM gates Team vesting, CRM tier accumulation, QR-009 production activation, and Pilot Run readiness. Reward must not start before Foundation, Wallet, and QR baseline tests pass.

# **19｜Conclusion**

# **RevB.1 裁定：Approved for G-ADR sign-off after this errata. NOT-000 / COM-008 / G0-001\~003 can run immediately; FND-000 starts only after ADR-000 evidence is committed. Reward development no longer waits for G-COM, but production activation and Pilot Run still require G-COM evidence.**

**Codex Development Specification v1.0 RevB.1 is a Day-0 Release Candidate Errata and is ready for G-ADR sign-off. Once ADR-000 evidence is committed, Foundation tasks may proceed; NOT-000, COM-008 and G0-001\~003 may continue immediately as non-application-code Day-0 work.**

