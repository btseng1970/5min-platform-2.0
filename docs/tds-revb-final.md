**5min coffee**

**平台 2.0 技術設計規格書**

Technical Design Specification (TDS)｜Version 1.0 RevB Final｜Codex Handoff Baseline

| 項目 | 內容 |
| :---- | :---- |
| 文件版本 | TDS v1.0 RevB Final Errata-of-Errata（Codex Release Approved） |
| 文件日期 | 2026 年 7 月 |
| Owner | 5min coffee / Best Moment Inc. |
| 基礎文件 | 5min Coffee Platform 2.0 SAD v1.0 RevC.1（Errata Applied） |
| 主要讀者 | System Architect、Tech Lead、Backend / Frontend Lead、Data Lead、Security、QA、Codex / AI Coding Agent |
| 審查目的 | 將 SAD RevC.1 的架構基線轉為可落地的 API、DDL、事件、佇列、CI/CD、測試與 Codex 任務規格；本版吸收 Senior Tech Lead final feedback、Codex Release errata 與 E1/E2 errata-of-errata，凍結為 Codex Release 技術契約。 |

## **Revision History**

| 版本 | 變更摘要 | 狀態 |
| :---- | :---- | :---- |
| TDS v1.0 RevA | 首次依 SAD v1.0 RevC.1 生成 Technical Design Specification。落地 DrawReserved-time randomization、PointLot/FIFO、PendingGrant、per-aggregate ordering、schema boundary、Notification Broker、Compliance Rule Engine 與 TDS Guardrails。 | 已併入 |
| TDS v1.0 RevB | 依 Senior Tech Lead feedback 加固：① Phase 1 採 DB-backed token，DrawReserved 單一 ACID 交易；② Pity counter 版本遷移；③ 匿名掃碼 draw 掛 pending\_grant\_id；④ Inventory Fact 為超賣唯一執法點；⑤ 容量現實檢查；⑥ Future-event buffer 防 OOM；⑦ PendingGrant claim 安全；⑧ Lot rollback algorithm；⑨ Codex engineering assertions。 | 已併入 |
| TDS v1.0 RevB Final | Final guardrails: UTC expiry, Negative Ledger checkout freeze, partitioned fact DDL, Codex final assertions and Cutover Gate G0. | 已併入 |
| TDS v1.0 RevB Final Errata | Codex Release 前置 errata：① 就地標註 SUPERSEDED 舊段落並禁止 Codex 引用；② scan\_event 分區唯一鍵與一碼一用執法點修正；③ Lot rollback worked example 鎖定語義；④ Revision/Open Issues 文件衛生；⑤ Draw idempotency unique violation 捕捉並回傳既有 draw。 | 已併入 |
| TDS v1.0 RevB Final Errata-of-Errata | Codex Release 前 E1/E2 殘留修正：① 修正 qr.code 原子狀態轉移失敗路徑，ALREADY\_USED/INACTIVE scan\_event 必須於 rollback 後以獨立交易落庫；② 第 13 章就地擴寫 SUPERSEDED 標註，pity\_counter 舊 PK 與 draw\_ledger 舊唯一鍵不得被 Codex 生成 DDL；③ Reward/QR task package 明確引用 36.1/36.2/36.3/41.2 修正版。 | 本版凍結／Codex Release Approved |

# **Contents｜目錄**

* 0 Executive Summary  
* 1 Design Baseline and Traceability  
* 2 Technical Standards and Global Conventions  
* 3 Module Boundary, Package Layout and Schema Ownership  
* 4 API Design Standards  
* 5 API Contracts: Member, Auth and Campaign  
* 6 API Contracts: QR Scan and PendingGrant  
* 7 API Contracts: Reward Draw and Prize Settlement  
* 8 API Contracts: Wallet, Redeem, Expiry and Reversal  
* 9 API Contracts: Notification, Team and CRM  
* 10 Admin / CMS Technical Flows  
* 11 Database Design: Common Infrastructure  
* 12 Database Design: Wallet PointLot and Ledger  
* 13 Database Design: Reward, Draw, Pity and Inventory  
* 14 Database Design: QR, Activation and PendingGrant  
* 15 Database Design: Member, Tier, Team and Notification  
* 16 Database Design: Compliance and IP Asset  
* 17 Event Contracts and Catalog  
* 18 Queue, Worker and Ordering Design  
* 19 Idempotency, Concurrency and Backpressure  
* 20 Reward Engine Detailed Algorithm  
* 21 Wallet FIFO, Expiry, Breakage and Migration  
* 22 QR Supply Chain Activation  
* 23 Notification Broker Implementation  
* 24 Compliance Rule Engine Implementation  
* 25 IP Asset Policy Implementation  
* 26 Dashboard, Analytics and Reconciliation  
* 27 Security, Privacy, RBAC and Audit  
* 28 Observability and Incident Runbook  
* 29 Test Strategy and Quality Gates  
* 30 Migration and Cutover Plan  
* 31 CI/CD Guardrails and Architecture Fitness Functions  
* 32 Capacity Model and Performance Test Inputs  
* 33 Codex Development Backlog  
* 34 Acceptance Checklist and Open Issues  
* 35 RevB Senior Tech Lead Hardening Addendum  
* 36 RevB Algorithm and Data Model Deltas  
* 37 RevB Detailed Guardrails for TDS and Codex  
* 38 RevB Acceptance Checklist and Final Handoff  
* 39 Final Guardrails Addendum for Codex Handoff  
* 40 Freeze Decision, Codex Release and Cutover Gate G0

| 治理註記：本 TDS 不新增 PRD 功能；所有產品需求以 PRD Rev D 為凍結來源，所有架構約束以 SAD RevC.1 為基線。 |
| :---- |

# **0｜Executive Summary**

TDS v1.0 RevB 的目的，是在 RevA 已完成工程基線的基礎上，吸收 Senior Tech Lead 的 P0 / Major / Minor feedback，將高併發抽獎、Wallet lot、PendingGrant、事件保序、QR 激活、Codex guardrails 等風險補成可實作與可驗收的技術規格。

| 設計主軸 | TDS RevA 落地方式 | Blocking 等級 |
| :---- | :---- | :---- |
| Draw Randomness | 抽獎結果於 DrawReserved 時刻決定；推薦 token-embodies-outcome 模型；Worker settlement 不重新擲骰。 | P0 |
| Reservation TTL | 未持久化 reservation 設短 TTL 與分鐘級 sweep；FraudReview / SettlementPending 已持久化保留不得被 sweep 釋放。 | P0 |
| Point Lot | 每筆入帳形成 lot；兌換 FIFO debit；到期 job 依 lot expiry；舊點數 migration 不得只用 opening balance。 | P0 |
| Pity Counter | per member × pool counter 與 DrawReserved 同交易；重放讀既有 pity\_after。 | P0 |
| Event Ordering | 關鍵事件流以 aggregate\_id 分區保序；consumer 檢查 aggregate\_version；future event 有 buffer bound。 | P0 |
| Boundary Enforcement | schema by bounded context；跨界寫入禁止；跨界讀取只走 projection 或 domain API；CI fitness function 阻擋違規。 | P1 |

| TDS Deliverable BoundaryPRD Rev D \= what and whySAD RevC.1 \= architecture baseline and guardrailsTDS RevA \= APIs, tables, events, queues, permissions, test gatesCodex Spec \= executable implementation tasks and test cases |
| :---- |

# **1｜Design Baseline and Traceability**

本章將 SAD RevC.1 第 30 章唯一有效 TDS Guardrails 轉為本 TDS 章節索引。

| SAD Guardrail | TDS 對應章節 | 本版處理 |
| :---- | :---- | :---- |
| Draw Randomness | 20 Reward Engine Detailed Algorithm | 明定 token-embodies-outcome、probability snapshot、no re-randomization。 |
| Reservation TTL | 19 Idempotency \+ 20 Reward Algorithm | 定義 TTL、sweep、ghost metrics、Last One high-risk mode。 |
| Point Lot | 12 Wallet DB \+ 21 Wallet FIFO | 定義 point\_lot、ledger\_entry allocation、expiry、migration policy。 |
| Pity Counter | 13 Reward DB \+ 20 Algorithm | 定義 pity\_counter 與 draw\_ledger 同交易欄位。 |
| Event Ordering | 17 Event Contracts \+ 18 Queue Design | 定義 partition key、aggregate\_version、stale/future handling。 |
| Read Consistency | 11-16 DB \+ 18 Queue \+ 21 Wallet | 定義 strong / eventual read models 與查詢路徑。 |
| PendingGrant | 6 API \+ 14 DB | 定義 anonymous QR flow、reserved-by-pending 預設。 |
| Boundary Enforcement | 3 Module Boundary \+ 31 CI | 定義 schema、package、lint、static SQL scanner。 |
| Capacity Model | 32 Capacity Model | 定義輸入、QPS 估算與壓測目標。 |
| Idempotency Store | 19 Idempotency | 區分 BFF、Domain、Worker stores。 |
| Money Precision | 24 Compliance \+ 27 Security | 定義 Money/Points/Probability Value Object 與禁用 Float/Double。 |
| QR Activation | 22 QR Supply Chain | Phase 1 B2C activation；B2B POS/ERP 為 ADR-004 gate。 |

| 設計基線：SAD RevC.1 指定第 30 章為唯一有效治理清單；本 TDS 已逐項展開，不回流 PRD。 |
| :---- |

# **2｜Technical Standards and Global Conventions**

## **2.1 Naming Convention**

| 類型 | 規範 | 範例 |
| :---- | :---- | :---- |
| API path | kebab-case \+ version prefix | /api/v1/reward/draws |
| Event type | Past tense domain event | DrawReserved, WalletLedgerPosted |
| DB schema | bounded context snake\_case | wallet.point\_lot, reward.draw\_ledger |
| DB table | singular or domain aggregate name; no ambiguous generic table | qr.code, reward.prize\_pool |
| ID | ULID/UUID compatible string; globally unique for events | event\_id, draw\_id, wallet\_ledger\_id |
| Money | minor unit integer for JPY; Decimal(18,4) for markets requiring decimals | yen\_amount\_bigint, twd\_amount\_decimal |
| Timestamp | UTC stored; user display localized by market/timezone | created\_at\_utc |

## **2.2 Global Technical Policies**

* 所有核心 command 必須接受 idempotency\_key 或 client\_request\_id；重送請求不得產生第二筆業務結果。  
* 所有寫入均需具備 correlation\_id；跨 API、outbox、queue、worker、notification、log 必須可追蹤。  
* 所有金額、點數、EV、機率比較禁止使用 Float/Double；須使用 Value Object 與高精度計算。  
* 所有可對外推播之訊息，只能經 Notification Broker；業務 module 禁止呼叫 LINE / Email / SMS provider。  
* 所有第三方 webhook payload 原文保留 raw\_event，再轉 canonical event 進 domain flow。  
* 所有 mutable config（機率、保底、合規、Tier 權重、頻控）需版本化並保留 maker-checker audit。

## **2.3 Common Error Model**

| HTTP | error\_code | 適用情境 | User-facing 行為 |
| :---- | :---- | :---- | :---- |
| 400 | VALIDATION\_FAILED | 欄位缺漏、格式錯誤、非法 state transition | 顯示欄位提示；不重試。 |
| 401 | AUTH\_REQUIRED | 需登入或 LINE binding | 導向登入/綁定。 |
| 403 | POLICY\_BLOCKED | 合規、授權、風控阻擋 | 顯示原因或客服代碼。 |
| 404 | RESOURCE\_NOT\_FOUND | 找不到 campaign / QR / order | 顯示失效或不存在。 |
| 409 | IDEMPOTENCY\_CONFLICT | 同 idempotency\_key 不同 payload | 拒絕；要求使用新 key。 |
| 409 | STATE\_CONFLICT | 重複掃碼、已兌換、已撤銷 | 顯示已使用/已失效。 |
| 423 | RESOURCE\_LOCKED | DrawReserved / Pending settlement / Frozen wallet | 顯示處理中。 |
| 429 | RATE\_LIMITED | 風控或 BFF backpressure | 顯示排隊中並拉長輪詢。 |
| 503 | DRAW\_PAUSED | Reward/Wallet 一致性或 queue critical | 暫停抽獎入口。 |

# **3｜Module Boundary, Package Layout and Schema Ownership**

Modular Monolith first 只有在 package、schema、repository、read contract 和 CI fitness function 同時成立時才有意義。本章定義工程邊界。

| Module | Package Prefix | DB Schema | Public Read Contracts |
| :---- | :---- | :---- | :---- |
| Campaign | app.campaign.\* | campaign.\* | campaign\_public.campaign\_summary, campaign\_public.sku\_brief |
| Member / CRM | app.member.\* / app.crm.\* | member.\*, crm.\* | crm\_public.member\_state\_summary |
| Wallet | app.wallet.\* | wallet.\* | wallet\_public.member\_wallet\_summary, wallet\_public.expiring\_soon |
| Reward | app.reward.\* | reward.\* | reward\_public.draw\_status, reward\_public.pool\_inventory\_summary |
| QR | app.qr.\* | qr.\* | qr\_public.qr\_batch\_status |
| Team | app.team.\* | team.\* | team\_public.team\_rank\_display |
| Notification | app.notification.\* | notification.\* | notification\_public.template\_stats |
| Compliance | app.compliance.\* | compliance.\* | compliance\_public.policy\_version\_summary |
| IP Asset | app.asset.\* | asset.\* | asset\_public.asset\_visibility\_summary |
| Analytics | app.analytics.\* | analytics.\* | analytics\_public.platform\_metric\_view |

## **3.1 Allowed and Forbidden Dependencies**

| 操作 | 允許方式 | 禁止方式 |
| :---- | :---- | :---- |
| 跨模組寫入 | 透過 owning module command/domain service 或事件 | 直接 INSERT/UPDATE/DELETE 對方 schema source-of-truth table |
| 跨模組讀取（高頻/非強一致） | 讀取 public projection/read model | JOIN 對方 ledger/fact/source table |
| 跨模組讀取（強一致） | 透過 domain service interface，該 service 自行保證一致性 | 在 caller SQL 內自行 join 多個 schema source table |
| Analytics | 由 event store / warehouse / projection 讀取 | 直接掃描交易表做 BI |
| Exception | Tech Lead waiver \+ expiry \+ projection backlog | 永久性 ad-hoc cross-schema join |

| CI Fitness Function Example\- Reject imports from app.wallet.internal.\* outside wallet module\- Reject SQL containing FROM wallet.ledger\_entry in non-wallet packages\- Allow SELECT from wallet\_public.member\_wallet\_summary\- Enforce migration file header: \-- owning\_context: wallet\- Generate dependency graph on every PR |
| :---- |

# **4｜API Design Standards**

| 項目 | 規格 |
| :---- | :---- |
| Versioning | 所有前台 API 使用 /api/v1；Admin API 使用 /admin/api/v1；未來 breaking change 另起 /v2。 |
| Authentication | Member API 使用 session/JWT \+ CSRF；LINE LIFF 需 line\_user\_id binding；Admin 需 MFA/SSO。 |
| Idempotency | POST command API 必須接受 Idempotency-Key header 或 client\_request\_id body。 |
| Correlation | BFF 生成或傳遞 X-Correlation-Id；所有下游 event、log、notification 帶入。 |
| Pagination | 列表 API 使用 cursor pagination；管理報表可使用 date range \+ page token。 |
| Validation | API layer 做 syntactic validation；domain service 做 business invariant validation。 |
| Error | 統一 error\_code、message、details、correlation\_id、retry\_after\_seconds。 |
| Clock | 所有 timestamp 以 ISO-8601 UTC 回傳；前端以 market timezone 呈現。 |

| Standard Error Response{  "error\_code": "STATE\_CONFLICT",  "message": "QR code has already been used.",  "details": {"qr\_code\_id": "qr\_...", "current\_state": "USED"},  "correlation\_id": "corr\_...",  "retry\_after\_seconds": null} |
| :---- |

## **4.1 API Security Headers**

| Header | Required | 用途 |
| :---- | :---- | :---- |
| Authorization | Y for authenticated routes | Member session/JWT or Admin token。 |
| Idempotency-Key | Y for POST commands | 防止重送造成重複業務結果。 |
| X-Correlation-Id | Y generated if absent | 跨系統追蹤。 |
| X-Client-Request-Id | Y for draw/scan/redeem | 前端操作唯一鍵。 |
| X-Market-Id | Y for multi-market admin actions | market policy routing。 |
| X-Admin-Reason-Code | Y for high-risk admin ops | audit reason。 |

# **5｜API Contracts: Member, Auth and Campaign**

| API | Method | Purpose | Key Response / Events |
| :---- | :---- | :---- | :---- |
| /api/v1/me | GET | 取得會員中心首頁所需狀態 | member\_state, wallet\_summary, tier\_display, team\_summary |
| /api/v1/auth/line/bind | POST | LINE LIFF 綁定會員 | LineBound event, member\_id |
| /api/v1/campaigns/current | GET | 取得當期 IP campaign | campaign\_id, market\_id, active windows, landing blocks |
| /api/v1/campaigns/{id}/products | GET | 取得 campaign SKU 列表 | sku\_id, price, availability, bridge\_weight display |
| /api/v1/member/preferences | GET/PUT | 取得/更新 consent 與訊息偏好 | PreferenceUpdated event |
| /api/v1/member/tier | GET | 顯示用等級與權益 | member\_tier\_display；不可用於 checkout 計價 |

| GET /api/v1/me response (abbreviated){  "member\_id": "mem\_01H...",  "line\_bound": true,  "lifecycle\_segment": "REPEAT",  "health\_score": 76,  "retention\_grade": "B",  "tier\_display": {"tier": "ROASTER", "benefits": \["8% discount"\], "grandfathering\_until": "2027-09-30"},  "wallet\_summary": {"available\_points": 1200, "frozen\_points": 0, "expiring\_soon\_points": 300},  "team\_summary": {"team\_id": "team\_...", "rank\_display": 12, "confirmed\_score": 5600}} |
| :---- |

| 強一致提醒：GET /api/v1/member/tier 回傳 member\_tier\_display，僅供顯示；checkout 折扣必須讀 member\_tier\_checkout 強一致模型。 |
| :---- |

# **6｜API Contracts: QR Scan and PendingGrant**

| API | Method | Auth | Purpose |
| :---- | :---- | :---- | :---- |
| /api/v1/qr/scan | POST | Optional | 掃碼入口；支援匿名掃碼，回傳 PendingGrant 或已登入獎勵流程。 |
| /api/v1/qr/pending-grants/{id} | GET | Optional \+ claim token | 查詢未註冊掃碼獎勵狀態。 |
| /api/v1/qr/pending-grants/{id}/claim | POST | Member | 綁定會員並入帳 PendingGrant。 |
| /api/v1/qr/codes/{id}/status | GET | Member/Ops | 客服/會員查詢碼狀態。 |
| /admin/api/v1/qr/batches/{id}/activate | POST | Admin Ops | B2C / channel activation。 |
| /admin/api/v1/qr/batches/{id}/revoke | POST | Security/Admin | 批次撤銷並導流 Review Queue。 |

| POST /api/v1/qr/scan request{  "code\_value": "encoded\_signed\_qr\_value",  "client\_request\_id": "scan\_...",  "device\_info": {"device\_id": "dev\_...", "user\_agent": "..."},  "geo\_location": {"source": "ip", "region": "Taipei"}}Response if anonymous:{  "status": "PENDING\_REGISTRATION",  "pending\_grant\_id": "pg\_...",  "expires\_at": "2026-08-01T00:00:00Z",  "registration\_url": "/register?pending\_grant\_id=pg\_...",  "qr\_state": "RESERVED\_BY\_PENDING"} |
| :---- |

| State | Meaning | Allowed Next |
| :---- | :---- | :---- |
| Created | 有效 QR 被匿名使用者掃描，建立 PendingGrant。 | Claimed, Expired, FraudReview |
| Claimed | 完成登入/註冊/LINE 或手機綁定後，獎勵入帳。 | Closed |
| Expired | 註冊期限未完成，依 campaign policy 釋回或作廢。 | Closed |
| FraudReview | 掃碼命中高風險或批次異常。 | Claimed, Rejected |

# **7｜API Contracts: Reward Draw and Prize Settlement**

| API | Method | Auth | Purpose |
| :---- | :---- | :---- | :---- |
| /api/v1/reward/draws | POST | Member or PendingGrant claim | 建立抽獎請求；DrawReserved 時刻決定結果。 |
| /api/v1/reward/draws/{draw\_id} | GET | Member | 查詢 draw 狀態；重送須回同一結果。 |
| /api/v1/reward/pools/{pool\_id} | GET | Public/Member | 取得公示機率與 disclosure version。 |
| /admin/api/v1/reward/pools | POST/PUT | Ops \+ Compliance | 管理賞池與版本。 |
| /admin/api/v1/reward/compensation-cases/{id}/approve | POST | Maker-checker | 高價補償案件核准。 |

| POST /api/v1/reward/draws requestHeaders:  Idempotency-Key: idem\_...Body:{  "campaign\_id": "cmp\_...",  "prize\_pool\_id": "pool\_...",  "source": "QR\_SCAN | POINT\_REDEEM | GACHA",  "client\_request\_id": "draw\_..."}Response:{  "draw\_id": "draw\_...",  "state": "DrawReserved",  "draw\_result": {"result\_type": "PRIZE", "prize\_tier": "B", "public\_label": "B賞"},  "probability\_version\_id": "probv\_...",  "inventory\_snapshot\_id": "invs\_...",  "settlement\_status": "PROCESSING",  "poll\_after\_seconds": 2} |
| :---- |

| Invariant | TDS Rule | Test Case |
| :---- | :---- | :---- |
| Randomness timing | draw\_result set during DrawReserved; worker cannot change result。 | Freeze probability version, create draw, mutate pool, assert draw result unchanged。 |
| Token embodies outcome | token\_id maps to outcome tier; atomic pop/reserve determines result。 | Concurrent 10k draw attempts; no duplicated token\_id。 |
| No admin assign win | Admin cannot set draw\_result; compensation uses separate case。 | Permission test rejects admin direct update。 |
| Idempotent redraw | Same idempotency key returns same draw\_id/status/result。 | Client retries 100 times under timeout。 |

# **8｜API Contracts: Wallet, Redeem, Expiry and Reversal**

| API | Method | Purpose | Consistency |
| :---- | :---- | :---- | :---- |
| /api/v1/wallet | GET | 取得可用點數、凍結點數、即將到期點數。 | available strong for current request; expiring eventual。 |
| /api/v1/wallet/redeem | POST | 點數兌換或點加金兌換。 | Strong consistent lots \+ ledger transaction。 |
| /api/v1/wallet/ledger | GET | 會員查詢點數明細。 | Eventual display。 |
| /admin/api/v1/wallet/adjustments | POST | 人工調整申請。 | Maker-checker。 |
| /admin/api/v1/wallet/reconciliation/run | POST | 手動對帳。 | Admin Finance。 |
| /internal/api/v1/wallet/reverse | POST | 退貨/chargeback 反向扣回。 | Strong ledger \+ lot allocation。 |

| POST /api/v1/wallet/redeem request{  "redemption\_rule\_id": "redeem\_...",  "points\_to\_use": 500,  "cash\_amount\_minor": 0,  "market\_id": "TW",  "client\_request\_id": "redeem\_..."}Wallet redeem transaction steps:1\. Lock active lots for member\_id by FIFO order2\. Verify available balance \>= requested points3\. Create ledger\_entry DEBIT with lot\_allocations4\. Update remaining\_points per lot5\. Emit WalletLedgerPosted and RedemptionCreated outbox events6\. Return redemption\_id and new available\_balance |
| :---- |

# **9｜API Contracts: Notification, Team and CRM**

| API | Method | Purpose |
| :---- | :---- | :---- |
| /internal/api/v1/notifications/requests | POST | 業務模組唯一通知入口；不可直連 LINE。 |
| /api/v1/notifications/preferences | GET/PUT | 會員管理 consent / frequency preference。 |
| /admin/api/v1/notifications/templates | POST/PUT | 管理 template、priority、channel。 |
| /api/v1/teams | POST | 建立戰隊；需符合 captain 條件。 |
| /api/v1/teams/{id} | GET | 戰隊頁與排行。 |
| /api/v1/teams/{id}/join | POST | 加入戰隊。 |
| /admin/api/v1/crm/segments/recalculate | POST | 手動觸發分層重算。 |

| NotificationRequested canonical command{  "event\_id": "evt\_...",  "member\_id": "mem\_...",  "template\_id": "tpl\_point\_expiring\_30d",  "priority\_level": 1,  "message\_type": "REWARD\_SERVICE",  "campaign\_id": "cmp\_...",  "context": {"expiring\_points": 300, "expires\_at": "2026-08-31"}}Broker decision outputs:NotificationScheduled | NotificationSuppressed | NotificationSent | NotificationBlocked |
| :---- |

| Team Score API 規則 | 技術要求 |
| :---- | :---- |
| 前台可顯示預估排行 | 必須標記 includes\_pending=true，且不得用於正式領獎。 |
| 正式排行只看 Confirmed Points | 由 team\_score\_ledger 批次結算；N+14 可配置。 |
| 退貨 / chargeback | 必須 emit TeamScoreReversed 並重算 rank。 |
| 高價戰隊賞 | 需 formal settlement \+ risk clear 才可 PrizeGranted。 |

# **10｜Admin / CMS Technical Flows**

Admin / CMS 是合規、賞池、IP 素材與 Wallet 調整的高風險操作面。所有高風險操作需 maker-checker、audit log、before/after snapshot。

| Flow | Required Steps | Approvals / Audit |
| :---- | :---- | :---- |
| Campaign Publish | Draft → validate required fields → ComplianceCheckRequested → PASS → Publishable → Published | Product Owner \+ optional Legal if JP or prize pool |
| Prize Pool Publish | Draft probability → Inventory attach → EV check → disclosure version → publish | Ops maker \+ Legal/Finance checker for JP |
| Compliance Policy Change | Create new policy\_version → rule tests → dual approval → activate from date | Legal \+ Business Owner |
| Manual Wallet Adjustment | Request → reason\_code → maker-checker → WalletLedgerPosted | Finance checker required above threshold |
| QR Batch Revoke | Security incident → revoke batch → Review Queue routing → notify Ops | Security / Tech Lead |
| IP Asset Expiry Override | License extension proof → update policy → CDN purge/job | IP Owner \+ Legal |

| Admin audit fields required for all high-risk operationsoperator\_id, approver\_id, reason\_code, before\_snapshot\_hash, after\_snapshot\_hash,entity\_type, entity\_id, policy\_version\_id, occurred\_at, correlation\_id, ip\_address |
| :---- |

# **11｜Database Design: Common Infrastructure**

以下為 TDS RevA 技術邏輯 schema；實際 DDL 型別需依最終 RDBMS 方言調整，但不得違反欄位語義、唯一鍵與索引要求。

## **11.1 Common Tables**

| Table | Owner | Purpose | Critical Constraints |
| :---- | :---- | :---- | :---- |
| platform.event\_outbox | Application Core | transactional outbox for domain/integration events | event\_id unique; status; retry\_count; aggregate\_id/version |
| platform.processed\_event | Worker/Consumer | consumer idempotency log | unique(consumer\_name, event\_id); optional business\_key |
| platform.idempotency\_record | BFF/API | request-level idempotency | unique(scope, idempotency\_key); payload\_hash |
| platform.audit\_log | Shared infra | append-only admin/domain audit | immutable; before/after hash; operator\_id |
| platform.raw\_webhook\_event | Integration | third-party raw payload storage | provider, provider\_event\_id unique, payload\_json |
| platform.job\_run | Worker/Scheduler | scheduled jobs and reconciliation results | job\_name, status, started\_at, ended\_at |

| event\_outbox key fields\- event\_id PK\- event\_type\- aggregate\_type, aggregate\_id, aggregate\_version\- payload\_json, payload\_version\- status: PENDING | PUBLISHED | FAILED | DEAD\- retry\_count, next\_retry\_at\- correlation\_id, causation\_id\- created\_at, published\_at |
| :---- |

## **11.2 Precision Types**

***\[SUPERSEDED by 37.5 / 39.5 / 41.3 where conflicting — TWD amount storage is integer NTD. Decimal is only permitted for future markets with explicit market policy, never for TW/JP business money calculations.\]***

| Value Object | Storage | Forbidden | Notes |
| :---- | :---- | :---- | :---- |
| Money | JPY: bigint yen minor unit; TW: integer NTD minor unit. Future markets may use Decimal only with explicit MarketCompliancePolicy. | float/double | market\_id determines rounding policy; TW/JP business money calculations use integer minor units only. |
| Points | bigint point\_amount | float/double | No fractional points unless policy\_version explicitly allows。 |
| Probability | decimal(20,12) or integer basis points/ppm | float-only comparison | Comparison uses explicit rounding\_policy。 |
| EV | decimal high precision | binary floating arithmetic | rule output stores input\_value, allowed\_value, calculation\_version。 |

# **12｜Database Design: Wallet PointLot and Ledger**

Wallet 的 source of truth 是 append-only ledger \+ point lot。Balance 是 projection；兌換路徑使用強一致讀。

| Table | Key Fields | Indexes / Constraints | Notes |
| :---- | :---- | :---- | :---- |
| wallet.point\_lot | lot\_id, member\_id, market\_id, point\_source, grant\_event\_id, original\_points, remaining\_points, grant\_at, expires\_at, status | idx(member\_id,status,expires\_at); idx(grant\_event\_id) | 每筆 credit 形成 lot；FIFO 消耗。 |
| wallet.ledger\_entry | ledger\_entry\_id, member\_id, entry\_type, points\_delta, lot\_allocations\_json, source\_event\_id, reason\_code | unique(source\_event\_id, entry\_type); idx(member\_id,created\_at) | append-only；不可 update/delete。 |
| wallet.balance\_projection | member\_id, available\_points, frozen\_points, negative\_points, projected\_at, projection\_version | PK(member\_id) | 可重建；兌換路徑需交易內鎖定。 |
| wallet.breakage\_provision | market\_id, campaign\_id, estimated\_unscanned\_points, recognized\_amount, close\_period | idx(close\_period, market\_id) | 月結與財務報表。 |
| wallet.redemption | redemption\_id, member\_id, points\_used, cash\_amount, state, idempotency\_key | unique(member\_id, idempotency\_key) | 點數兌換或點加金。 |
| wallet.manual\_adjustment\_case | case\_id, member\_id, requested\_delta, reason\_code, maker\_id, checker\_id, state | idx(state); approval required above threshold | 高風險操作 maker-checker。 |

| FIFO debit pseudo-querySELECT lot\_id, remaining\_points, expires\_atFROM wallet.point\_lotWHERE member\_id \= :member\_id AND status \= 'ACTIVE' AND remaining\_points \> 0 AND expires\_at \> now()ORDER BY expires\_at ASC, grant\_at ASCFOR UPDATE;Then allocate requested\_points across lots and append ledger\_entry(DEBIT). |
| :---- |

| Ledger Entry Type | Creates / Updates Lot? | Notes |
| :---- | :---- | :---- |
| CREDIT | Creates point\_lot | scan, mission, purchase, compensation。 |
| DEBIT | Allocates active lots | redeem, draw, point+cash。 |
| EXPIRE | Marks lot expired | expiry job; not user command。 |
| REVERSAL | May restore original lot if unexpired | RevC.1: do not reset aging by creating new lot。 |
| FREEZE | No lot consumption; freezes points/voucher | fraud or refund dispute。 |
| NEGATIVE | Creates obligation | refund after points already used。 |

# **13｜Database Design: Reward, Draw, Pity and Inventory**

***\[SUPERSEDED by 36.1 / 36.2 / 36.3 / 41.2 where conflicting — Phase 1 reward.prize\_token is DB-backed. The pity\_counter PK and draw\_ledger unique keys in this section are historical and must not be used for DDL. Implement 36.2 for pity rule version semantics and 36.3 for anonymous pending\_grant\_id draw ownership. Codex tasks must not generate DDL from superseded rows.\]***

| Table | Key Fields | Constraints | Purpose |
| :---- | :---- | :---- | :---- |
| reward.prize\_pool | prize\_pool\_id, campaign\_id, market\_id, pool\_type, state, compliance\_policy\_id | idx(campaign\_id,state) | 賞池主檔。 |
| reward.probability\_version | probability\_version\_id, prize\_pool\_id, version\_no, disclosure\_version, published\_at | unique(pool\_id, version\_no) | 公示機率版本。 |
| reward.prize\_token | token\_id, prize\_pool\_id, probability\_version\_id, outcome\_tier, prize\_item\_id, token\_state | unique(token\_id); idx(pool\_id,state) | token-embodies-outcome；Phase 1 authoritative token source is DB-backed. Memory TokenSource is future path only and requires new ADR/failure model. |
| reward.draw\_ledger | draw\_id, member\_id (nullable for anonymous), pending\_grant\_id (required for anonymous), campaign\_id, prize\_pool\_id, idempotency\_key, draw\_state, draw\_result, token\_id\_hash, probability\_version\_id, inventory\_snapshot\_id, pity\_before, pity\_after | SUPERSEDED by 36.3 where conflicting. Registered unique: (member\_id, campaign\_id, idempotency\_key). Anonymous unique: (pending\_grant\_id, campaign\_id, idempotency\_key). Oversell enforcement belongs to inventory\_fact; draw\_ledger constraints are defensive only. | 抽獎最終事實表；anonymous draw 可先掛 pending\_grant\_id，claim 後回填 member\_id，不重新擲骰。 |
| reward.inventory\_fact | inventory\_fact\_id, prize\_item\_id, state, draw\_id, fulfillment\_id | unique(prize\_item\_id,state active) | 實體獎品庫存事實。 |
| reward.pity\_counter | member\_id, prize\_pool\_id, current\_count, pity\_rule\_version (field only), updated\_by\_draw\_id | SUPERSEDED by 36.2 where conflicting. PK(member\_id, prize\_pool\_id). pity\_rule\_version must not be part of PK; version changes use approved inherit / proportional / reset migration policy. | 與 DrawReserved 同交易更新；規則版本變更不得讓既有 count 歸零。 |
| reward.compensation\_case | case\_id, draw\_id, member\_id, reason\_code, proposed\_action, state, maker\_id, checker\_id | idx(state) | 補償，不改抽獎結果。 |

| \[SUPERSEDED by 36.1 / 41.1 — DO NOT IMPLEMENT\]DrawReserved DB transaction (logical)BEGIN;  \-- 1\. Validate idempotency unique key or return existing draw  \-- 2\. Pop/reserve prize\_token from reservation layer or DB-backed token source  \-- 3\. Insert reward.draw\_ledger with draw\_result, probability\_version\_id, pity\_before/after  \-- 4\. Update reward.pity\_counter  \-- 5\. Insert event\_outbox(DrawReserved)COMMIT;Worker settlement later executes the existing draw\_result; it never re-randomizes. |
| :---- |

# **14｜Database Design: QR, Activation and PendingGrant**

| Table | Key Fields | Constraints / Indexes | Notes |
| :---- | :---- | :---- | :---- |
| qr.qr\_batch | qr\_batch\_id, campaign\_id, sku\_id, printer\_id, signing\_key\_version, batch\_state, channel\_id | idx(campaign\_id, batch\_state) | 批次與供應鏈追蹤。 |
| qr.code | qr\_code\_id, qr\_batch\_id, code\_hash, code\_state, assigned\_order\_id, assigned\_pos\_transaction\_id, used\_by\_member\_id | unique(code\_hash); idx(batch\_id,state) | 不存明文 code\_value。 |
| qr.activation\_event | activation\_event\_id, qr\_batch\_id, channel, order\_id, shipment\_id, retail\_pos\_transaction\_id, activation\_scope | idx(qr\_batch\_id, created\_at) | B2C Phase 1；B2B interface only。 |
| qr.scan\_event | scan\_event\_id, qr\_code\_id, member\_id, device\_id, ip\_address\_hash, geo\_region, risk\_score, code\_verify\_result, idempotency\_key | No global one-code-one-use unique enforcement here. Partition-local defensive indexes must include scan\_timestamp\_utc. Authoritative one-code-one-use enforcement is qr.code atomic state transition. | All scan attempts are recorded as facts; scan\_event is not the enforcement table for code consumption. |
| qr.pending\_grant | pending\_grant\_id, qr\_code\_id, campaign\_id, reward\_intent\_json, state, claim\_token\_hash, expires\_at | unique(qr\_code\_id) where state active | 匿名掃碼註冊漏斗。 |
| qr.review\_case | case\_id, qr\_batch\_id, qr\_code\_id, risk\_reason, state, owner\_id | idx(state, risk\_reason) | INVALID spike 或 revoked batch。 |

| QR code state machineGenerated \-\> Printed \-\> PreActive \-\> Active \-\> ReservedByPending \-\> Used                         |                         |                         \+-\> Suspended             \+-\> Expired/ReleasedAny non-terminal state \-\> RevokedPhase 1 scope: B2C order/shipment activation \+ abstract activation\_event interface.B2B POS/ERP activation is gated by ADR-004 and Product/Ops approval. |
| :---- |

# **15｜Database Design: Member, Tier, Team and Notification**

| Table | Key Fields | Purpose / Consistency |
| :---- | :---- | :---- |
| member.profile | member\_id, legacy\_member\_id, line\_user\_id\_hash, email\_hash, phone\_hash, state | 會員身份；PII minimization。 |
| crm.member\_state\_projection | member\_id, lifecycle\_segment, health\_score, retention\_grade, risk\_status, updated\_at | CRM 顯示與劇本；near-real-time \+ nightly correction。 |
| crm.member\_tier\_checkout | member\_id, effective\_tier, discount\_rate, grandfathering\_until, version | checkout 強一致讀；影響金額。 |
| crm.member\_tier\_display | member\_id, display\_tier, next\_tier\_progress, updated\_at | 前台顯示用；bounded stale。 |
| team.team | team\_id, campaign\_id, captain\_member\_id, state | 戰隊主檔。 |
| team.score\_ledger | score\_event\_id, team\_id, member\_id, contribution\_type, score\_delta, score\_state, source\_order\_id | Pending/Confirmed/Frozen/Reversed append-only。 |
| notification.request | notification\_request\_id, member\_id, template\_id, priority, message\_type, state | Broker input。 |
| notification.send\_history | notification\_id, member\_id, channel, template\_id, provider\_message\_id, sent\_at, block\_status | 頻控與 attribution。 |
| notification.preference | member\_id, channel, message\_type, opt\_in, frequency\_level | Consent Center。 |

| Tier / Team Rule | Technical Requirement |
| :---- | :---- |
| Tier downgrade 30-day warning | emit TierDowngradeWarningScheduled / Sent through Notification Broker Level 2。 |
| Team contribution confirmed | Only Confirmed Points can determine final rank and rewards。 |
| Grade X | Line blocked / cannot communicate；not counted as core team contribution。 |
| Grandfathering | grandfathering\_until stored in checkout projection and cannot be reduced by nightly formula。 |

# **16｜Database Design: Compliance and IP Asset**

| Table | Key Fields | Purpose |
| :---- | :---- | :---- |
| compliance.market\_policy | policy\_id, market\_id, country\_code, currency, active\_version\_id | 市場別政策入口。 |
| compliance.rule\_version | rule\_version\_id, policy\_id, rule\_domain, params\_json, calculation\_version, rounding\_policy, state | 可版本化規則。 |
| compliance.check\_result | check\_id, entity\_type, entity\_id, rule\_id, input\_value, allowed\_value, result, required\_approver | Publish gate 稽核。 |
| compliance.approval | approval\_id, rule\_version\_id, maker\_id, checker\_id, reason\_code, state | Legal/Business dual approval。 |
| asset.ip\_asset | asset\_id, campaign\_id, asset\_type, storage\_key, license\_policy\_id, state | IP 素材主檔。 |
| asset.license\_policy | license\_policy\_id, market\_id, usage\_scope, license\_start, license\_end, resolution\_limit, post\_campaign\_visibility | 授權政策。 |
| asset.asset\_access\_log | access\_id, asset\_id, member\_id, decision, policy\_version, served\_variant | 素材授權查核。 |
| asset.cdn\_purge\_job | job\_id, asset\_id, reason, state, provider\_result | 到期、撤銷與 fallback。 |

| JP General Premium rule test cases\- transaction\_value \= 999 JPY \=\> max\_premium\_value \= 200 JPY\- transaction\_value \= 1000 JPY \=\> max\_premium\_value \= 200 JPY\- transaction\_value \= 1001 JPY \=\> max\_premium\_value \= floor/round according to approved rounding\_policyEvery check\_result stores rule\_id, input\_value, allowed\_value, rounding\_policy, calculation\_version. |
| :---- |

# **17｜Event Contracts and Catalog**

所有事件使用統一 envelope。Payload schema 版本化；consumer 必須 idempotent。

| Envelope Field | Required | Notes |
| :---- | :---- | :---- |
| event\_id | Y | globally unique |
| event\_type | Y | DrawReserved, WalletLedgerPosted |
| occurred\_at | Y | business occurrence time UTC |
| aggregate\_type / aggregate\_id | Y | ordering and trace |
| aggregate\_version | Y for critical streams | consumer stale/future check |
| event\_sequence | Y where ordering required | monotonic per aggregate |
| correlation\_id | Y | trace user flow |
| causation\_id | N | previous command/event |
| source\_module | Y | owning module |
| market\_id / campaign\_id | Y if campaign related | policy routing |
| payload\_version | Y | schema compatibility |
| idempotency\_key | Y for user commands | replay protection |

## **17.1 Core Event Catalog**

| Event | Aggregate | Partition Key | Consumer Highlights |
| :---- | :---- | :---- | :---- |
| OrderCompleted | order | order\_id | Wallet bridge, CRM segment, Team pending。 |
| ReturnCompleted | order | order\_id | Wallet reversal, Team reversed, Tier recalculation。 |
| QRCodeScanned | qr\_code | qr\_code\_id | QR risk, PendingGrant, Reward draw。 |
| PendingGrantClaimed | pending\_grant | pending\_grant\_id | Wallet credit, Collection unlock。 |
| DrawReserved | draw | member\_or\_pending\_grant\_owner\_key | Settlement worker and notification processing; same owner draw stream must be ordered. |
| PrizeGranted | draw | draw\_id | Collection, fulfillment, notification。 |
| WalletLedgerPosted | wallet | wallet\_id/member\_id | Balance projection, finance report。 |
| PointLotExpired | wallet | wallet\_id/member\_id | Balance projection, notification attribution。 |
| NotificationRequested | notification | member\_id | Broker priority/frequency。 |
| CompliancePolicyApproved | compliance | policy\_id | Publish gate。 |
| TierDowngradeWarningScheduled | member | member\_id | Broker Level 2 send。 |

# **18｜Queue, Worker and Ordering Design**

| Queue / Topic | Producer | Consumer | Partition Key / Ordering |
| :---- | :---- | :---- | :---- |
| domain-events.order | Order Module | Wallet, CRM, Team | order\_id |
| domain-events.wallet | Wallet Module | CRM, Finance, Dashboard | wallet\_id/member\_id |
| domain-events.reward | Reward Module | Settlement, Notification, Collection | campaign\_id \+ member\_id or draw\_id |
| domain-events.qr | QR Module | Reward, Risk, Analytics | qr\_code\_id |
| notification.requests | All modules | Notification Broker | member\_id |
| compliance.checks | Admin/Campaign/Reward | Compliance Worker | entity\_id |
| asset.jobs | IP Asset | CDN purge worker | asset\_id |
| reconciliation.jobs | Schedulers | Finance/Tech workers | job\_id |

| Consumer version handlingif event.aggregate\_version \<= current\_version:    mark event as stale\_duplicate and ackelif event.aggregate\_version \> current\_version \+ 1:    buffer up to max\_future\_buffer\_size with expires\_at    if buffer full or expired: move to DLQ and alertelse:    process transactionally and update current\_version |
| :---- |

| Worker | Retry Policy | DLQ Trigger | Owner |
| :---- | :---- | :---- | :---- |
| RewardSettlementWorker | exponential backoff; max attempts by prize risk | unique violation unresolved, DB timeout beyond threshold | Tech Lead |
| WalletProjectionWorker | retry until success; no silent drop | ledger/projection mismatch | Finance Ops \+ Tech |
| NotificationDispatchWorker | provider-specific retry; duplicate suppression | provider failure threshold or block spike | CRM Owner |
| QRCodeSweepWorker | scheduled sweep; idempotent | ghost\_reservation\_count \> threshold | Tech Lead |
| ComplianceCheckWorker | no blind retry on policy error | policy missing or formula error | Legal \+ Product |
| AssetExpiryWorker | retry CDN purge | expired asset still served | IP Owner \+ Ops |

# **19｜Idempotency, Concurrency and Backpressure**

| Layer | Owner | Store / Key | TTL / Retention |
| :---- | :---- | :---- | :---- |
| Request Idempotency | BFF/API | platform.idempotency\_record(scope, idempotency\_key, payload\_hash) | Low-risk scan: hours; high-value draw/redeem: settlement window \+ margin。 |
| Business Idempotency | Owning Domain | DB unique key, e.g. reward.draw\_ledger(member\_id,campaign\_id,idempotency\_key) | Permanent business history。 |
| Worker Idempotency | Consumer | platform.processed\_event(consumer\_name,event\_id) | Retention by event policy; cannot expire before replay window。 |
| Third-party Webhook | Integration Adapter | raw\_webhook\_event(provider, provider\_event\_id) | Retain per compliance/audit policy。 |

## **19.1 Reward Backpressure**

| State | Trigger | BFF Behavior | Exit Criteria |
| :---- | :---- | :---- | :---- |
| Normal | queue depth normal | Direct draw request accepted | N/A |
| Elevated Queue | queue depth warning | Continue but display slower polling | queue age below warning |
| Backpressure | oldest message age or worker lag high | Queueing screen; throttle new draw; increase retry\_after | lag recovered |
| Draw Queueing | admission control active | Reserve only within capacity; otherwise return queued status | worker capacity recovered |
| Draw Paused | Reward/Wallet mismatch or DB critical | Reject new draw with DRAW\_PAUSED | reconciliation pass \+ DLQ clear |
| Recovery | systems recovered | Gradual ramp up | stable period complete |

| Backpressure response exampleHTTP 429 RATE\_LIMITED{  "state": "DRAW\_QUEUEING",  "message": "抽獎排隊中，請稍候。",  "poll\_after\_seconds": 10,  "correlation\_id": "corr\_..."} |
| :---- |

# **20｜Reward Engine Detailed Algorithm**

## **20.1 Token-Embodies-Outcome Model**

***\[SUPERSEDED by 36.1 and 41.1 — DO NOT IMPLEMENT legacy reservationLayer / mixed TokenSource pseudocode in this section. Phase 1 uses DB-backed token with SELECT ... FOR UPDATE SKIP LOCKED in a single ACID transaction. Codex tasks must ignore all text/tables marked SUPERSEDED.\]***

TDS RevA 採用 SAD RevC.1 建議之標準模型：權杖即結果。賞池發布時或啟用時，依 probability\_version 產生/同步預洗牌 token queue；每個 token 已內嵌 outcome tier 與必要 prize\_item\_id。原子取出 token 即同時完成判定與保留。

| \[SUPERSEDED by 36.1 / 41.1 — DO NOT IMPLEMENT\]This legacy pseudocode was kept only as historical context. Use the DB-backed SKIP LOCKED algorithm in 36.1 / 41.1.Draw command pseudocodehandleDraw(command):  assert idempotency\_key is valid  existing \= findDrawByIdempotency(member\_id, campaign\_id, idempotency\_key)  if existing: return existing  tx begin    validate campaign/pool/member/risk/compliance snapshot    lock probability\_version\_id and inventory\_snapshot\_id    token \= reservationLayer.popToken(prize\_pool\_id, probability\_version\_id)    if token is None: return ReservationFailed    draw\_result \= token.outcome    pity\_before \= loadPity(member\_id, prize\_pool\_id)    pity\_after \= applyPityRule(pity\_before, draw\_result, pity\_rule\_version)    insert draw\_ledger(... draw\_result, token\_id\_hash, pity\_before, pity\_after, state='DrawReserved')    update pity\_counter(... pity\_after, updated\_by\_draw\_id=draw\_id)    insert event\_outbox(DrawReserved)  tx commit  return DrawReserved response |
| :---- |

## **20.2 Reservation TTL and Sweep**

| Reservation Type | TTL / Governance | Sweep Behavior |
| :---- | :---- | :---- |
| Unpersisted token reservation | 90-180 seconds initial recommendation; shorter for Last One/high-value mode | Sweep every 1 minute during campaign; release ghost token。 |
| Persisted DrawReserved | governed by settlement window, not raw TTL | No release by ghost sweep；only settlement/review workflow。 |
| FraudReview hold | explicit hold expiration per risk policy | Excluded from sweep; escalates to review SLA。 |
| SettlementPending | worker SLA \+ DLQ handling | Excluded from ghost sweep; incident if too old。 |

| Metric | Threshold Direction | Action |
| :---- | :---- | :---- |
| ghost\_reservation\_count | must be near zero; threshold by pool risk | Freeze high-value draw if exceeds threshold。 |
| draw\_settlement\_lag\_seconds | oldest pending settlement | Backpressure or Draw Paused。 |
| dlq\_count\_by\_campaign | must not explode | DLQ runbook and freeze pool。 |
| duplicate\_idempotency\_hit\_rate | spike indicates client retry issue | Frontend retry interval adjustment。 |

# **21｜Wallet FIFO, Expiry, Breakage and Migration**

## **21.1 Point Lot Lifecycle**

| PointLot lifecycleCreated \-\> Active \-\> PartiallyConsumed \-\> Consumed                         |                         \+-\> Expired                         \+-\> Frozen \-\> Active / ReversedReversal semantics (RevC.1):\- If original lot is unexpired: restore points to original lot, preserving original expires\_at.\- If original lot has expired: do not create a new lot to reset aging; route to compensation policy.\- If consumed points cannot be restored: create negative ledger or freeze future benefits. |
| :---- |

| Job | Frequency | Reads / Writes | Owner |
| :---- | :---- | :---- | :---- |
| Expiry Reminder Candidate | Daily | Read point\_lot; write notification requests via Broker | CRM/Wallet |
| Point Expiry Job | Daily or hourly near expiry campaigns | Append EXPIRE ledger; update lot status | Wallet |
| Breakage Estimation | Monthly close | Estimate unscanned QR potential liability | Finance |
| Wallet Reconciliation | Daily \+ month close | Ledger sum vs projection vs lots | Finance Ops \+ Tech |
| Legacy Lot Migration Validation | Before cutover | Compare old points source vs imported point\_lot | Migration Team |

## **21.2 Migration Policy**

| Legacy Data Availability | Migration Treatment | Customer Communication |
| :---- | :---- | :---- |
| Has grant batch \+ expiry | Import each lot with original grant\_at/expires\_at | No special notice except 2.0 migration。 |
| Has expiry date only | Create one lot per expiry bucket | Explain expiry remains unchanged。 |
| Balance only | Finance/Product approves migration\_expiry\_policy; create transitional lot(s) | Display transition policy and expiring notice。 |
| Negative or disputed balance | Import as frozen/negative ledger | 客服 review before redemption。 |

# **22｜QR Supply Chain Activation**

| Channel | Phase 1 Scope | Activation Event | Risk Acceptance |
| :---- | :---- | :---- | :---- |
| B2C official store | In scope | OrderCompleted / shipment\_created links assigned QR range to Active | Low; owned order/shipment data。 |
| B2B offline POS | Out of scope for Phase 1; interface only | retail\_pos\_transaction\_id via POS/ERP webhook | Requires Product \+ Ops ADR-004 decision gate。 |
| Wholesale / channel batch | PreActive only | channel\_batch\_event\_id may control visibility, not asset grant | No points until sale activation if POS integration required。 |
| Compromised batch | In scope | Security incident triggers batch revoke | Review Queue and batch isolation。 |

| Scan validation order1\. Decode and verify signature with signing\_key\_version2\. Check qr\_batch state and code state3\. Check activation status for channel/order/POS4\. Check one-time use / pending grant state5\. Evaluate risk velocity/device/IP/geo6\. Create scan\_event and continue to PendingGrant or Reward flow |
| :---- |

| INVALID Spike Rule | TDS Default |
| :---- | :---- |
| Metric | invalid\_code\_rate\_by\_batch\_id over 5 minutes |
| Warning | TDS to set threshold after pilot; warning raises risk level。 |
| Critical | Sustained abnormal spike triggers batch revoke or review-only mode。 |
| Isolation | Only affected batch\_id/signing\_key\_version routed to Review Queue；other batches unaffected。 |

# **23｜Notification Broker Implementation**

| Component | Technical Responsibility | Data Store |
| :---- | :---- | :---- |
| NotificationRequest API | validate source, template\_id, priority, correlation\_id | notification.request |
| Consent Evaluator | message\_type/channel opt-in rules | notification.preference |
| Frequency Engine | 72h / 7d cap, 24h cooldown, Level rules | notification.send\_history |
| Priority Scheduler | rank by priority, expiry urgency, member health, commercial value | buffer queue |
| Template Renderer | render localized template and variables | notification.template |
| Channel Adapter | LINE/Email/SMS send and provider retries | notification.provider\_event |
| Attribution Collector | open/click/block/conversion and template block attribution | notification.send\_history |

| Broker suppression rule exampleif member.cooldown\_active and priority\_level \> 1:    buffer\_or\_suppress(reason='COOLDOWN\_ACTIVE')elif weekly\_count \>= cap and priority\_level \== 3:    suppress(reason='WEEKLY\_CAP\_EXCEEDED')elif circuit\_breaker.level3\_paused:    suppress(reason='LEVEL3\_CIRCUIT\_BREAKER')else:    send(channel) |
| :---- |

| Event Hook | Priority | Template / Notes |
| :---- | :---- | :---- |
| PointExpiring30 / PointExpiring7 | Level 1/2 depending policy | Must read expiring\_soon; not redeem authorization。 |
| TierDowngradeWarningScheduled | Level 2 | 30-day warning from RevC minor hook。 |
| PrizeGranted | Level 1 | Asset/service notification。 |
| NewCampaignLaunched | Level 3 | First to suppress under circuit breaker。 |

# **24｜Compliance Rule Engine Implementation**

| Rule Domain | Inputs | Formula / Check | Output |
| :---- | :---- | :---- | :---- |
| JP General Lottery | transaction\_value, prize\_values, expected\_sales, probability\_distribution | max\_single\_prize \= min(value\*20, 100000 JPY); total \<= expected\_sales\*2% | PASS/BLOCKED |
| JP General Premium | transaction\_value, premium\_value | \<1000 JPY \=\> \<=200 JPY; \>=1000 JPY \=\> \<=20% | PASS/BLOCKED |
| Payment Services Act JP | point\_source, paid/free, point+cash flag | paid points / top-up default disabled until legal approval | ENABLE/DISABLE |
| TW Consumer Protection | probability disclosure, refund policy, prize description | parameters configurable by Legal | PASS/BLOCKED |
| IP License Policy | asset usage, market, resolution, campaign status | visibility decision | ALLOW/FALLBACK/HIDE |

| Compliance check output{  "result": "BLOCKED",  "rule\_id": "JP\_GENERAL\_PREMIUM\_2026\_001",  "input\_value": "JPY 250",  "allowed\_value": "JPY 200",  "rounding\_policy": "JPY\_MINOR\_UNIT\_INTEGER",  "calculation\_version": "calc\_v1",  "required\_approver": \["LEGAL", "BUSINESS\_OWNER"\]} |
| :---- |

| Numeric Guardrail | TDS Test |
| :---- | :---- |
| No Float/Double | Static analysis rejects float/double in compliance and wallet packages。 |
| JPY minor unit | All JPY amounts stored and compared as integer yen\_amount。 |
| Boundary tests | ¥999 / ¥1000 / ¥1001 tests for General Premium。 |
| Rounding transparency | check\_result stores rounding\_policy and calculation\_version。 |

# **25｜IP Asset Policy Implementation**

| Access Scenario | Policy Evaluation | Response |
| :---- | :---- | :---- |
| Active campaign product visual | license active \+ usage\_scope includes web/product | Serve original or configured resolution。 |
| Archived unlocked collection | member has unlocked \+ post\_campaign\_visibility=true | Serve low-resolution asset。 |
| Archived not unlocked | no member entitlement | Generic placeholder。 |
| Expired draw animation | license\_end passed or usage\_scope false | Hide/disable rendering。 |
| Old shared OG link | new generation disabled; existing link route to fallback | Fallback page/image。 |

| Asset URL decisionGET /asset/{asset\_id}?member\_id=... \-\> evaluate license\_policy\_id \+ campaign\_status \+ member entitlement \+ market\_id \-\> ALLOW\_SIGNED\_URL | LOW\_RES\_SIGNED\_URL | FALLBACK | HIDE \-\> log asset\_access\_log(decision, policy\_version) |
| :---- |

| Job | Trigger | Actions |
| :---- | :---- | :---- |
| LicenseExpiryJob | license\_end \- 30/14/7/1 days and at expiry | Notify IP Owner, prepare fallback, disable generation。 |
| CDNPurgeJob | policy becomes HIDE or asset replaced | Purge provider cache; verify not served。 |
| OGFallbackJob | campaign archived/hidden | Update OG meta and fallback image。 |
| AssetAccessAudit | scheduled | Detect expired asset served。 |

# **26｜Dashboard, Analytics and Reconciliation**

| Dashboard | Latency | Data Source | Owner |
| :---- | :---- | :---- | :---- |
| Campaign War Room | Minutes | event views \+ order/QR/reward streams | Ops \+ Product |
| Platform Health | Near-real-time | metrics from BFF, queue, workers, DB reconciliation | Tech Lead |
| Wallet Finance | Daily/month close | wallet ledger \+ point lot \+ breakage | Finance |
| CRM Segment | Daily \+ temporary flags | warehouse \+ member projections | CRM Owner |
| Team/Tier | Near-real-time \+ daily official | team score ledger \+ member projections | Ops \+ CRM |
| Compliance Audit | On-demand \+ publish | compliance check\_result \+ approvals | Legal |

## **26.1 Analytics Reconciliation**

| Pair | Source of Truth | Reconciliation Owner | Frequency |
| :---- | :---- | :---- | :---- |
| Internal Purchase Event vs GA4 Purchase | Internal event store | Data Lead | Daily |
| QRCodeScanned vs GA4 Scan Click | QR scan\_event | Data Lead | Daily |
| NotificationSent vs LINE provider delivered | notification.send\_history \+ provider event | CRM/Data | Daily |
| Wallet balance projection vs ledger | wallet ledger \+ point\_lot | Finance/Tech | Daily/month close |
| Reward inventory vs draw ledger | reward.inventory\_fact \+ draw\_ledger | Tech/Ops | Hourly during campaign |

| Analytics 原則：GA4 / GTM event 不可作為 source of truth；只能作為 attribution 與行為分析輔助。 |
| :---- |

# **27｜Security, Privacy, RBAC and Audit**

| Role | Permissions | Approval Required |
| :---- | :---- | :---- |
| Ops Admin | Campaign draft, SKU setup, QR batch view, dashboard | Publish campaign requires Product Owner or policy pass。 |
| Reward Ops | Prize pool draft, inventory mapping | Publish requires compliance check and maker-checker for high value。 |
| Finance | Wallet reports, reconciliation, manual adjustment checker | Manual adjustment maker-checker。 |
| Legal | Compliance policy approve, IP license policy approve | Business Owner co-approval for rule changes。 |
| CRM Owner | Notification templates, segments, campaigns | Level 3 bulk send subject to Broker and circuit breaker。 |
| Security/Tech Lead | Batch revoke, incident response, key rotation | Audit log mandatory。 |

| Security Area | TDS Control |
| :---- | :---- |
| Admin auth | SSO/MFA, session timeout, IP allowlist optional。 |
| QR signing keys | key\_version, rotation policy, revoke by batch, secrets manager。 |
| PII minimization | hash IP/device where possible; geo coarse region only。 |
| Audit immutability | append-only audit\_log; restrict delete/update grants。 |
| Data retention by market | TW/JP/APPI retention policy; open issue for JP data localization。 |
| Webhook security | signature verification, replay window, raw payload retention。 |

# **28｜Observability and Incident Runbook**

| Metric | Dimension | Alert Action |
| :---- | :---- | :---- |
| event\_ingestion\_delay\_seconds | event\_type, source\_module | Pause event-triggered marketing if \>5min。 |
| queue\_depth / oldest\_message\_age | queue\_name, campaign\_id | Backpressure; draw queueing or pause。 |
| ghost\_reservation\_count | campaign\_id, prize\_pool\_id | Sweep and freeze high-value draw if threshold exceeded。 |
| wallet\_ledger\_projection\_mismatch | member\_id, close\_period | Reward/Wallet incident; freeze affected flows。 |
| duplicate\_prize\_item\_grant\_count | prize\_pool\_id | Critical incident; stop draw。 |
| invalid\_code\_rate | batch\_id, signing\_key\_version | Risk escalation; batch revoke if persistent。 |
| notification\_block\_rate | template\_id, campaign\_id | Pause Level 3 and template review。 |
| expired\_asset\_served\_count | asset\_id, campaign\_id | CDN purge / hide asset incident。 |

| Incident | Owner | SLA | Recovery Criteria |
| :---- | :---- | :---- | :---- |
| Reward/Wallet mismatch | Tech Lead \+ Finance Ops | 30 min | Draw Ledger, Wallet Ledger, Inventory Fact reconcile。 |
| Queue/Event Delay \> 5 min | Tech Lead | 30 min | oldest message age back under threshold \+ compensation jobs complete。 |
| Invalid QR spike | Security / Tech Lead | 30 min | source blocked or batch revoked; risk indicators fall。 |
| LINE block spike | CRM Owner | 2 hours | Template attribution analysis complete; frequency or copy adjusted。 |
| Compliance blocked publish | Legal \+ Product | Before release | MarketCompliancePolicy pass and approval recorded。 |
| IP asset expiry failure | IP Owner \+ Ops | Before/at expiry | CDN purge verified; fallback active。 |

# **29｜Test Strategy and Quality Gates**

| Test Type | Scope | Must Include |
| :---- | :---- | :---- |
| Unit Tests | Value objects, rules, state machines | Money precision, compliance formulas, tier formulas, pity rules。 |
| Property Tests | Reward token/outcome distribution and no oversell | Concurrent draws cannot duplicate token/prize\_item\_id。 |
| Integration Tests | API \+ DB transaction \+ outbox | DrawReserved atomicity, Wallet redeem FIFO, PendingGrant claim。 |
| Contract Tests | Events, webhooks, provider adapters | payload\_version backward compatibility。 |
| Migration Tests | Legacy member, wallet, QR, tier | point lot migration and grandfathering。 |
| Load Tests | Scan/draw peak | capacity model QPS, queue backpressure, DB IOPS。 |
| Security Tests | QR brute force, admin RBAC, webhook replay | invalid code spike, authz, signature verification。 |
| Reconciliation Tests | ledger/projection/warehouse | wallet/reward/GA4 daily reconciliation。 |

## **29.1 Blocking Test Cases**

1. Same idempotency\_key repeated 100 times returns the same draw\_id and draw\_result, never a second PrizeGranted。  
2. DrawReserved result remains unchanged after probability\_version or inventory changes before settlement。  
3. Unpersisted token reservation expires and is swept within one campaign sweep interval。  
4. FraudReview and SettlementPending persisted reservations are not released by ghost sweep。  
5. Wallet FIFO redeem consumes earliest expiring lots first and emits correct lot\_allocations。  
6. Return reversal restores unexpired original lot without resetting expires\_at。  
7. Future event beyond aggregate\_version \+ 1 is bounded-buffered, then DLQ \+ alert if unresolved。  
8. JPY compliance boundary tests pass at ¥999 / ¥1000 / ¥1001 without Float/Double。  
9. Inactive QR cannot grant points; revoked batch routes to Review Queue only for that batch。  
10. No module can call LINE provider API directly; CI rejects direct imports/references。

# **30｜Migration and Cutover Plan**

| Area | Cutover Approach | Verification |
| :---- | :---- | :---- |
| Member identity | Map legacy\_member\_id to member\_id; preserve legacy reference。 | Duplicate detection and LINE binding conflict report。 |
| Discount tier | Migrate old tiers to Contribution Tier with 365-day grandfathering。 | Before/after benefit comparison; no member loses rights。 |
| Points | Import by lot if possible; if balance-only, use approved migration\_expiry\_policy。 | Finance reconciliation before enabling redemption。 |
| Historical orders | Read-only import for contribution metrics and customer service。 | Order count/amount checksum。 |
| Legacy QR | Decide old scan flow vs new verification; signed QR only for new batches。 | Legacy QR sample test and policy decision。 |
| Consent | Import opt-in preferences; default conservative for marketing。 | Messaging dry run with suppression report。 |
| Campaign assets | Add license\_policy fields before migration to collection/archive。 | Expired/hidden asset test。 |

| Cutover gatesG0: Schema and projections deployed without customer-facing economics changeG1: Wallet migration and finance reconciliation passG2: QR new-batch signing and B2C activation pilot passG3: Reward draw load test and no-oversell test passG4: Notification Broker dry-run suppression report passG5: Admin publish gate and compliance tests passG6: Launch window with rollback plan and incident owners on-call |
| :---- |

# **31｜CI/CD Guardrails and Architecture Fitness Functions**

| Guardrail | CI/CD Rule | Blocking Level |
| :---- | :---- | :---- |
| Schema ownership | Migration file must declare owning\_context; cross-context write grants rejected。 | P0 |
| Static SQL scanner | Reject production SQL joining source-of-truth tables across schemas。 | P0 |
| Package import lint | Reject imports from other module internal packages。 | P0 |
| No direct provider send | Reject direct LINE/Email/SMS SDK usage outside notification adapter。 | P0 |
| No Float/Double | Reject primitive floating type in wallet/reward/compliance packages。 | P0 |
| Event schema registry | Reject unversioned event payloads or breaking changes without migration。 | P1 |
| OpenAPI contract | Validate API examples and error models。 | P1 |
| Migration tests | Run point lot and tier migration fixture tests。 | P1 |

| Pull request required evidence\- Architecture fitness function report\- DB migration ownership check\- Event schema compatibility check\- Unit \+ integration test summary\- Load test evidence for reward/scan changes\- Security review for QR, wallet, compliance, notification changes |
| :---- |

# **32｜Capacity Model and Performance Test Inputs**

| Input | Definition | Owner | Required for |
| :---- | :---- | :---- | :---- |
| campaign\_units\_sold\_day1 | 檔期首日預估出貨/售出盒數 | Product/Sales | scan/draw QPS estimate |
| scan\_activation\_rate\_24h | 首 24 小時掃碼率 | Product/Data | QR scan traffic |
| peak\_concentration\_window | 尖峰集中時間窗秒數 | Product/Ops | burst QPS |
| draws\_per\_scan | 每次掃碼平均觸發事件數 | Product | reward/queue volume |
| retry\_multiplier | timeout/client retry 放大係數 | Tech Lead | BFF/idempotency sizing |
| target\_qps | units \* scan\_rate \* draws\_per\_scan \* retry\_multiplier / window\_seconds | Architect | capacity planning |

| Capacity sizing templatePeak Draw QPS \= campaign\_units\_sold\_day1              \* scan\_activation\_rate\_24h              \* draws\_per\_scan              \* retry\_multiplier              / peak\_window\_secondsTDS load tests must size:\- BFF rate limit and idempotency store throughput\- Reservation layer ops/sec and TTL sweep\- Queue throughput and worker concurrency\- DB write IOPS for draw\_ledger, point\_lot, ledger\_entry\- Dashboard event latency under peak |
| :---- |

| Flow | User-facing Target | Internal Target |
| :---- | :---- | :---- |
| QR scan open result | \<= 3 seconds when healthy | event persisted near real-time |
| High-value draw | may show Processing | DrawReserved persisted before response or clear Processing state |
| Event ingestion | N/A | \< 5 minutes; otherwise pause event-triggered marketing |
| Wallet redeem | transactional response | strong consistent lots and balance |
| Notification send | depends on Broker scheduling | Level 1 immediate unless duplicate/risk |

# **33｜Codex Development Backlog**

| Epic | Codex Task Bundle | Definition of Done |
| :---- | :---- | :---- |
| Foundation | Project skeleton, package boundaries, schema ownership, event envelope, idempotency infra | CI fitness functions pass。 |
| Wallet | point\_lot, ledger\_entry, FIFO redeem, expiry, reversal, reconciliation | All Wallet blocking tests pass。 |
| Reward | token-embodies-outcome, DrawReserved transaction, pity counter, settlement worker, DLQ | No oversell property/load tests pass。 |
| QR | signed code verification, batch state, B2C activation, scan\_event, PendingGrant | Inactive/revoked/anonymous flows pass。 |
| Notification | Broker, consent, priority, cooldown, provider adapter, attribution | No direct send; suppression tests pass。 |
| Compliance | rule engine, JP formulas, high precision value objects, publish gate | JP boundary tests and approval audit pass。 |
| IP Asset | policy evaluator, signed/fallback access, expiry jobs, CDN purge | Expired asset access tests pass。 |
| Dashboard | Platform health metrics, reconciliation reports, campaign war room views | Runbooks linked and metrics populated。 |
| Migration | legacy identity/tier/point lot/QR migration scripts and checksums | Cutover gates G0-G6 pass。 |

## **33.1 Codex Prompt Guardrails**

* Codex 不得改變 PRD/SAD/TDS 的 domain rules；任何疑義先建立 Open Issue。  
* 每個 task 必須同時產出 implementation、unit test、integration test、migration or rollback notes。  
* 所有涉及 Wallet/Reward/Compliance 的 task 必須包含 no Float/Double、idempotency、audit log 檢查。  
* 任何 SQL 跨 schema 讀取需明確標示 read model 或 waiver，不得偷偷 join source table。

# **34｜Acceptance Checklist and Open Issues**

| Category | Must Pass Before Codex Spec | Status |
| :---- | :---- | :---- |
| Draw Randomness | DrawReserved-time result, no worker re-randomization, probability snapshot traceable | □ |
| Reservation TTL | TTL/sweep/ghost metrics and FraudReview exemption implemented | □ |
| Point Lot | DDL, FIFO debit, expiry job, migration policy, reversal semantics complete | □ |
| Pity Counter | Same transaction with DrawReserved; replay-safe | □ |
| Event Ordering | Partition keys, aggregate\_version, bounded future buffer, DLQ implemented | □ |
| Read Consistency | Strong vs eventual read model list and query path documented | □ |
| PendingGrant | Anonymous scan flow and expiry/fraud policies implemented | □ |
| Boundary Enforcement | schema grants, package layout, static scanner, fitness function active | □ |
| Capacity Model | Product inputs and peak QPS sizing approved | □ |
| Idempotency Store | BFF/domain/worker stores and TTL defined | □ |
| Money Precision | Value objects and JP boundary tests pass | □ |
| QR Activation | B2C activation done; B2B gate explicit | □ |
| Notification Broker | Only outbound channel; direct provider calls blocked | □ |
| Analytics Reconciliation | Internal event vs GA4 mapping and owner defined | □ |
| Japan Open Issues | APPI/cross-border/data residency/DPA decisions recorded before Phase 3 | □ |

## **34.1 Open Issues**

| Issue | Impact | Owner / Next Step |
| :---- | :---- | :---- |
| Existing commerce platform constraints | May affect identity merge, order callbacks, legacy QR | Tech Lead audit before TDS RevB。 |
| Finance breakage policy | Affects month-close and deferred liability | Finance defines recognition policy before Phase 1 launch。 |
| Japan legal opinion | Affects point+cash, paid points, gacha config | Legal before Phase 3 design freeze。 |
| B2B POS activation scope | Determines retail channel QR safety | ADR-004 Product \+ Ops gate。 |
| BI vs custom dashboard | Delivery schedule and data model | Codex-stage ADR track / implementation option; TDS RevB Final does not block release. |
| IP asset signed URL implementation | True license expiry enforcement | Codex-stage ADR track / implementation option; policy baseline remains mandatory. |

## **TDS RevA Interim Conclusion（superseded by RevB）**

TDS v1.0 RevA 已完成第一版技術基線；本段為歷史紀錄，現行有效的 RevB 裁決、演算法與驗收條件以第 35–38 章為準。

# **35｜RevB Senior Tech Lead Hardening Addendum**

本章將 Senior Tech Lead feedback 轉化為 TDS RevB 的強制技術裁決與實作 guardrails。TDS RevA 仍為基線，但凡與本章衝突者，以 RevB 裁決為準。本章對應 SAD RevC.1 第 30 章 TDS Guardrails，並進一步補齊 P0 / Major / Minor 的代碼級約束。

## **35.1｜RevB P0 裁決總表**

| P0 | 裁決 | TDS RevB 必須落地 |
| :---- | :---- | :---- |
| P0-1 DrawReserved 交易模型 | Phase 1 預設採 DB-backed token；判定、保留、落帳、pity update 與 outbox 寫入同一 ACID transaction。Memory reservation 僅保留為 TokenSource 介面後方的未來擴展，不作 Phase 1 預設。 | 修正第 20.1 偽代碼；禁止在持有 DB lock 時呼叫外部記憶體層。 |
| P0-2 Pity counter 版本遷移 | pity counter PK 不得讓版本升級造成 count 歸零；新 pity\_rule\_version 啟用時，必須繼承前版本 count 或依核准折算政策遷移。 | 新增 pity\_rule\_migration 表與 blocking test case。 |
| P0-3 匿名掃碼 draw 歸屬 | 採路徑 A：匿名掃碼時即可判定並產生開獎動畫；draw\_ledger.member\_id 可空，先掛 pending\_grant\_id，claim 後回填 member\_id。 | 修正 draw\_ledger unique key 與 API auth。 |
| P0-4 超賣不變量執法點 | Inventory Fact 是唯一 authoritative oversell enforcement；draw\_ledger 的 prize\_item\_id constraint 僅為防禦性檢查。 | 若採 PostgreSQL partial unique index，需標示方言依賴；未定 RDBMS 時以一般唯一約束與 state table 替代。 |
| P0-5 容量現實檢查 | 以首日 10,000 盒、24h 掃碼率 50%、10 分鐘吸收 20%、重試放大 x3 估算，峰值約 5 QPS；十倍放大約 50 QPS。Phase 1 不需要 memory reservation 作主路徑。 | 第 32 章加入容量估算與 DB-backed token 裁決依據。 |

## **35.2｜Tech Lead 加固指令：必須寫入實作與測試**

| 加固領域 | RevB 指令 | 驗收條件 |
| :---- | :---- | :---- |
| Token 釋放與 DB 一致性 | 若未來啟用 memory reservation，sweep worker 釋放 token 前不得只看 TTL；必須強一致查 reward.draw\_ledger 與 platform.event\_outbox，確認沒有 pending / compensation lock。 | 不存在「token 被釋回後補償任務又補寫 DB」的 oversell race condition。 |
| Future-event buffer 防 OOM | 禁止純 in-memory buffer；future events 需使用分散式 TTL store 或持久 facts staging。max\_future\_buffer\_size 與 TTL 必須參數化。 | 單一 aggregate 超出上限時觸發 backpressure 或 DLQ，不造成 Worker OOM。 |
| PendingGrant claim 安全 | claim\_token\_hash 採 salted SHA-256 或同級雜湊；API 不回傳可長期重放的明文 token；claim domain flow 必須經 risk\_score、device\_id、member\_id 頻率上限。 | 24 小時內 member/device claim 次數超標時拒絕或進 Review Queue。 |
| Wallet Lot rollback | Return reversal 不得直接對 consumed lot 加回 remaining\_points；需依最近 DEBIT 反向遞歸回滾 lot allocation，無法回滾時建立 Negative Ledger Entry。 | 任何 lot.remaining\_points 不得大於 original\_points；reconciliation 100% 通過。 |
| Codex assertions | 所有 Codex tasks 必須附帶 no Float/Double、no cross-schema write、only \*\_public view read、provider direct-call ban 等硬性工程斷言。 | CI/CD 若發現違規關鍵字或 SQL pattern，P0 fail build。 |

# **36｜RevB Algorithm and Data Model Deltas**

## **36.1｜Reward Draw Phase 1 Algorithm：DB-backed Token Default**

Phase 1 的 Reward Draw 不再以外部記憶體層作主路徑。TokenSource 仍保留介面抽象，但預設實作為 DB-backed token table。此裁決降低 distributed race、sweep 補償複雜度與 lock convoy 風險，並符合現實容量模型。

BEGIN TRANSACTION  
  \-- 1\. idempotency: read existing draw if client\_request\_id was already processed  
  existing \= SELECT \* FROM reward.draw\_ledger  
             WHERE business\_idempotency\_key \= :key  
             FOR UPDATE;  
  IF existing THEN RETURN existing;

  \-- Note: SELECT ... FOR UPDATE cannot lock a non-existent row.  
  \-- First concurrent requests may both read no row; the INSERT unique constraint below is the final arbiter.  
  \-- On unique violation, catch the error, ROLLBACK, SELECT the existing draw by business\_idempotency\_key,  
  \-- and RETURN the existing draw state/result. Do NOT surface a 500 error and do NOT redraw.

  \-- 2\. lock member/pool pity counter in deterministic order  
  pity \= SELECT \* FROM reward.pity\_counter  
         WHERE member\_or\_pending\_grant\_key \= :owner\_key  
           AND prize\_pool\_id \= :pool\_id  
         FOR UPDATE;

  \-- 3\. select token atomically; token embodies outcome  
  token \= SELECT \* FROM reward.prize\_token  
          WHERE prize\_pool\_id \= :pool\_id  
            AND status \= 'AVAILABLE'  
          ORDER BY token\_sequence  
          FOR UPDATE SKIP LOCKED  
          LIMIT 1;  
  IF no token THEN ROLLBACK; RETURN ReservationFailed;

  \-- 4\. reserve token and insert ledger/fact/outbox in same ACID boundary  
  UPDATE reward.prize\_token SET status='RESERVED', reserved\_by=:draw\_id WHERE token\_id=:token\_id;  
  INSERT INTO reward.draw\_ledger(... draw\_result, pending\_grant\_id/member\_id, pity\_before, pity\_after ...);  
  INSERT INTO reward.inventory\_fact(... state='RESERVED' ...);  
  INSERT INTO platform.event\_outbox(... event\_type='DrawReserved' ...);  
COMMIT;  
RETURN DrawReserved(draw\_id, draw\_result);

ON UNIQUE\_VIOLATION(business\_idempotency\_key):  
  ROLLBACK;  
  existing \= SELECT \* FROM reward.draw\_ledger WHERE business\_idempotency\_key \= :key;  
  RETURN existing;

* 不得在 DB transaction 內等待外部 Redis / cache 網路往返。  
* 若未來切換 memory TokenSource，必須另開 ADR/TDS Rev 並重寫 sweep、compensation、capacity 與 failure model。  
* DrawReserved 的 outcome、probability\_version\_id、inventory\_snapshot\_id、pity\_before/after 必須同 transaction 持久化。

## **36.2｜Pity Counter Version Migration**

| 資料表 / 欄位 | 設計 |
| :---- | :---- |
| reward.pity\_counter | PK 建議為 owner\_key \+ prize\_pool\_id；current\_rule\_version 作欄位，不作會導致歸零的獨立 PK 軸。若需保存多版本，需有 active flag 與 migrated\_from\_version。 |
| reward.pity\_rule\_migration | 記錄 from\_version、to\_version、policy\_type（inherit / proportional\_convert / reset\_with\_notice）、approved\_by、effective\_at。 |
| Blocking test case | 會員在舊規則 count=60 時切換新 rule\_version，若 policy=inherit，新 counter 必須仍為 60；若 proportional\_convert，需依核准公式折算且通知會員。 |

## **36.3｜Anonymous Draw Ownership via PendingGrant**

RevB 裁決採「匿名掃碼即判定」路徑，保留掃碼開獎體驗。匿名者的 draw 不掛 member\_id，而掛 pending\_grant\_id；claim 成功後回填 member\_id 並完成 Wallet / Collection 入帳。

| 項目 | RevB 設計 |
| :---- | :---- |
| reward.draw\_ledger.member\_id | nullable；未登入掃碼時為 NULL。 |
| reward.draw\_ledger.pending\_grant\_id | 匿名 draw 必填；與 pending\_grant 建立唯一關係。 |
| Unique key | registered：member\_id \+ campaign\_id \+ idempotency\_key；anonymous：pending\_grant\_id \+ campaign\_id \+ idempotency\_key。 |
| Claim flow | claim\_token \+ authenticated member \+ risk check 通過後，將 pending\_grant\_id 對應 draw\_ledger 回填 member\_id；不得重新擲骰。 |
| Fraud review | 若 claim 命中高風險，PendingGrant 轉 FraudReview，draw\_result 不入帳也不重抽。 |

## **36.4｜Oversell Invariant：Inventory Fact as Sole Enforcement**

| 不變量 | RevB 裁決 | TDS 實作 |
| :---- | :---- | :---- |
| 同一 prize\_item\_id 不可兩次授予 | Inventory Fact 是唯一 authoritative enforcement。 | inventory\_fact 中 active RESERVED / GRANTED 狀態需有唯一約束或等價防線。 |
| draw\_ledger prize\_item\_id | 防禦性與稽核用途，不作唯一裁判。 | 可保留 nullable / defensive constraint，但 reconciliation 以 inventory\_fact 為準。 |
| RDBMS 可移植性 | partial unique index 屬 PostgreSQL 方言。 | 若 RDBMS 未定，TDS 必須標示方言依賴或改採 status table / lock row。 |

## **36.5｜Capacity Reality Check and Performance Baseline**

| 參數 | Baseline | Stress x10 |
| :---- | :---- | :---- |
| campaign\_units\_sold\_day1 | 10,000 boxes | 100,000 boxes |
| scan\_activation\_rate\_24h | 50% | 50% |
| peak concentration | 20% of scans in 10 minutes | 20% of scans in 10 minutes |
| retry\_multiplier | x3 | x3 |
| Peak QPS | 10,000 × 50% × 20% × 3 / 600 ≈ 5 QPS | ≈ 50 QPS |

Architecture implication：Phase 1 峰值為十位數 QPS，DB-backed token 可承擔，且比 memory reservation 更容易確保單一 ACID transaction、公平稽核與防超賣。memory reservation 作為未來逃生口，不作第一版主路徑。

# **37｜RevB Detailed Guardrails for TDS and Codex**

## **37.1｜Future-event Buffer：Distributed TTL Store or Facts Staging**

| Guardrail | Required Design |
| :---- | :---- |
| Storage | 禁止純單機 in-memory buffer；採 distributed TTL store 或 persistent future\_event\_staging table。 |
| Capacity | max\_future\_buffer\_size\_per\_aggregate 必須為設定值；超出時不 Ack 或轉 DLQ，並觸發 backpressure。 |
| TTL | future\_event\_buffer\_ttl\_seconds 必須設定；逾時轉 DLQ \+ alert，不得無界等待。 |
| Metric | future\_buffer\_count、future\_buffer\_overflow\_count、oldest\_future\_event\_age 進 Platform Health。 |

## **37.2｜PendingGrant Claim Security**

| 項目 | RevB 要求 |
| :---- | :---- |
| claim token | claim\_token\_hash \= SHA-256(salt \+ token) 或同等強度；salt 不暴露於前端。 |
| API 回傳 | registration\_url 需攜帶短效 claim session reference；不得暴露長效明文 claim token。 |
| Claim verification | 必須同時驗證 pending\_grant\_id、claim token、authenticated member、device\_id、risk\_score、IP/geo velocity。 |
| Hard cap | 單一 member\_id 與單一 device\_id 24 小時 claim 匿名獎勵次數有硬上限；超限進 Review Queue。 |
| Replay defense | Claimed / Expired / FraudReview 狀態不可重複 claim；重送回傳同一結果。 |

## **37.3｜Wallet Lot Rollback Algorithm**

ReturnCompleted / ChargebackConfirmed 反向扣回不得違反 lot 物理限制。核心 invariant：remaining\_points \<= original\_points，且任何 reversal 都必須可由 ledger entries 重建。

ReturnReversal(order\_reward\_event):  
  credits \= find credit ledger entries created by original order/reward event  
  for each credit in credits ordered by grant\_at DESC:  
      lot \= lock point\_lot(credit.lot\_id)  
      unconsumed \= lot.remaining\_points  
      amount\_to\_reverse \= credit.points

      if unconsumed \>= amount\_to\_reverse:  
          append LedgerEntry(REVERSAL, lot\_id, \-amount\_to\_reverse)  
          lot.remaining\_points \-= amount\_to\_reverse  
      else:  
          append LedgerEntry(REVERSAL, lot\_id, \-unconsumed)  
          lot.remaining\_points \= 0  
          consumed\_gap \= amount\_to\_reverse \- unconsumed  
          rollback\_recent\_debits(consumed\_gap, original\_credit\_lot\_id)

  if consumed\_gap cannot be released because redeemed physical reward is irreversible:  
      append NegativeLedgerEntry(member\_id, amount=consumed\_gap, reason=RETURN\_AFTER\_REDEMPTION)  
      block high-value redemption until negative balance is cleared

* rollback\_recent\_debits 必須依最近 DEBIT 的 lot\_allocations 逆向釋放其他未過期 lot，不得重置到期日。  
* 若原 lot 已過期，依 SAD RevC.1：不得新建 lot 重置帳齡；進補償或 negative ledger 路徑。  
* 到期 job、兌換、退貨 reversal 均需遵守同一 lot lock order：expires\_at ASC, lot\_id ASC。

## **37.4｜CI/CD and Codex Engineering Assertions**

| Assertion | CI/CD Rule |
| :---- | :---- |
| No Float / Double | wallet、reward、compliance 模組之 entity、value object、DDL、test、comment 若出現 float/double 關鍵字，P0 fail build；允許白名單僅限文件引用的 negative test。 |
| No cross-context write | 除 platform.event\_outbox 外，非 owning context 不得 INSERT/UPDATE/DELETE 他 context schema。 |
| Cross-context read | 只允許 SELECT FROM \*\_public.\* projection/view 或透過 Domain Service interface；禁止讀 source fact / ledger tables。 |
| No provider direct send | LINE / SMS / Email provider client 只能在 notification module；其他 module import provider client 直接 fail。 |
| Reward invariants | 同一 idempotency\_key 不得生成兩筆 draw；同一 prize\_item\_id 的 active inventory fact 不得重複。 |

## **37.5｜Major / Minor Deltas**

| Issue | RevB Decision |
| :---- | :---- |
| M1 FIFO lock order | 兌換、到期、退貨 rollback 全部以 expires\_at ASC, lot\_id ASC 鎖定 point\_lot。 |
| M2 balance\_projection | Projection 僅供顯示；兌換授權唯一依據為交易內 active lots 聚合與 lock。 |
| M3 high-volume tables | qr.scan\_event、platform.event\_outbox、notification.send\_history 按月分區；PUBLISHED outbox 歸檔。 |
| M4 claim hijack | claim API 必須驗 claim\_token；registration\_url 不得只帶 pending\_grant\_id；加 claim rate limit。 |
| M5 legacy QR cutover | G2 前必須定案 legacy QR adapter 或日落日期；不可停留在 decide。 |
| M6 /api/v1/me | 建立 member\_home\_summary read model 與短 TTL cache；定義延遲預算與 stale label。 |
| Minor TWD precision | TWD 定案 integer NTD；不使用 decimal(18,4) or integer。 |
| Minor draw partition key | 同會員 draw 需保序，partition key 定案為 member\_or\_pending\_grant\_owner\_key。 |
| Minor DRAW\_PAUSED response | DRAW\_PAUSED 回 503 Service Unavailable \+ Retry-After；rate limited 回 429。 |
| Minor notification.preference | notification.preference 必須包含 market\_id。 |
| Minor BFF limit | TDS RevB baseline：draw request per member 5/min，per device 20/min，per IP 120/min；依壓測與活動級別調整。 |

# **38｜RevB Acceptance Checklist and Final Handoff**

| Category | RevB Acceptance Criteria | Blocking |
| :---- | :---- | :---- |
| Reward Draw | Phase 1 使用 DB-backed token；DrawReserved 單一 ACID transaction 內完成 token reserve、draw\_ledger、inventory\_fact、pity update、outbox。 | P0 |
| Memory Token Future Path | 若未來啟用 memory TokenSource，sweep 釋放前必須查 DB/outbox/compensation lock；不得只依 TTL 釋放。 | P0 |
| Pity Migration | pity rule version change 不得讓 count 歸零；inherit/convert/reset policy 有 migration table 與會員告知。 | P0 |
| Anonymous Draw | draw\_ledger 可掛 pending\_grant\_id；claim 後回填 member\_id，不重新擲骰。 | P0 |
| Oversell Enforcement | Inventory Fact 是唯一 authoritative enforcement；draw\_ledger constraint 為防禦性。 | P0 |
| Capacity | 第 32 章包含 baseline 5 QPS / stress 50 QPS；DB-backed token 為 Phase 1 合理裁決。 | P0 |
| Future Buffer | max\_future\_buffer\_size 與 TTL 參數化；禁止純 in-memory buffer；overflow 進 DLQ/backpressure。 | P1 |
| PendingGrant Security | claim\_token\_hash salted；claim 驗 member/device/risk/frequency；24h hard cap。 | P1 |
| Wallet Lot Rollback | Reversal 透過 lot allocation 逆向回滾或 negative ledger；不直接加回 consumed lot。 | P1 |
| Codex Guardrails | Codex tasks 必須附工程斷言；CI 擋 float/double、cross-schema write、provider direct send。 | P1 |

## **TDS RevB Conclusion**

TDS v1.0 RevB 已將 Senior Tech Lead 的 P0 / Major / Minor feedback 轉化為可實作、可測試、可由 CI/CD 執行的工程規格。RevB 明確裁決 Phase 1 採 DB-backed token，修正匿名掃碼與 draw ownership、pity version migration、oversell enforcement、Wallet lot rollback、future-event buffer、PendingGrant claim security 與 Codex engineering assertions。若本版通過 Technical Review，下一步可生成 Codex Development Specification v1.0，將各章拆解為 AI Coding Agent 可執行的 task、migration、test 與 seed data。

# **39｜Final Guardrails Addendum for Codex Handoff**

本章將 Senior Tech Lead final feedback 正式收斂為 TDS RevB Final 的硬性工程約束。RevB 的 DB-backed token、SKIP LOCKED、Lot Rollback Algorithm 與 Codex Prompt Guardrails 維持不變；本章只補足交付 Codex 前的最後三條臨界防線與 Cutover Gate 輸入。

## **39.1｜RevB Technical Validation**

| 亮點 | 工程評價 | Final 狀態 |
| :---- | :---- | :---- |
| DB-backed token \+ SKIP LOCKED | Phase 1 使用 SELECT ... FOR UPDATE SKIP LOCKED 取得 reward.prize\_token，使同一賞池下的並行抽獎可跳過已鎖定權杖，避免 lock convoy；以本平台 RevB 容量模型（baseline 約 5 QPS、stress 約 50 QPS）可滿足高峰需求。 | 保留為 Phase 1 預設。 |
| Token-embodies-outcome | 權杖即結果，DrawReserved 決定結果，Worker settlement 不重新擲骰，符合公平稽核與 probability\_version 對帳。 | 保留為 P0。 |
| Lot Rollback Algorithm | 退貨/chargeback 不重置 lot 帳齡，而是沿 lot\_allocations 逆向回滾；若無可回補額度則建立 Negative Ledger。 | 保留為 Wallet P0。 |

## **39.2｜Midnight Crux：UTC Expiry and Cross-market Time Boundary**

風險：台灣與日本市場共用平台時，若 Point Expiry Job 於 Application Layer 以 local timezone 進行時間加減，可能造成 JP 點數於 TW 午夜失效或延遲失效，導致到期提醒、負債認列與客訴不一致。

| 項目 | TDS Final Guardrail | Codex / DDL Assertion |
| :---- | :---- | :---- |
| Timestamp Storage | 所有 grant\_at、expires\_at、scan\_timestamp、created\_at 欄位一律以 UTC ISO-8601 或 timestamptz 儲存；欄位命名建議使用 \*\_at\_utc。 | DDL 不得使用無時區 timestamp 作為帳本、點數、expiry、outbox 的事實時間。 |
| Expiry SQL | Point Expiry Job 的過期判定必須由 DB server 的 UTC timestamp 原子比對完成，不得在 Application code 先轉換 local time 後再送 SQL。 | Codex 產生 Expiry Job 時不得出現 LocalDateTime.now()、Asia/Taipei、Asia/Tokyo、local timezone arithmetic 作為判定基礎。 |
| Market Display | 市場別日界線只用於前台顯示與提醒文案；expires\_at\_utc 於點數入帳時計算並落庫，後續不依使用者裝置時區重算。 | Notification 可依 market\_id 顯示 local date，但不得改變 ledger expiry decision。 |
| Test Cases | 必測 TW/JP 午夜、月末、年末、UTC day boundary；JP 到期不得因 TW 時區晚 1 小時失效。 | CI 需包含 UTC boundary tests；fail 即阻擋 merge。 |
| **Expiry Job invariant:UPDATE wallet.point\_lotSET status \= 'EXPIRED'WHERE status \= 'ACTIVE'  AND expires\_at\_utc \<= CURRENT\_TIMESTAMP\_AT\_UTC\_FROM\_DB;\-- No application-local timezone computation is allowed in expiry eligibility.** |  |  |

## **39.3｜Negative Ledger to Checkout Tier Circuit Breaker**

風險：Negative Ledger 只鎖定高價兌換仍不足。若會員仍保有 7 折或高階 Tier checkout 折扣，黑產可在負點數狀態下持續以折扣套利。

| 事件 / 狀態 | 系統行為 | 強一致要求 |
| :---- | :---- | :---- |
| NegativeLedgerOpened | wallet.ledger\_entry 產生 entry\_type \= NEGATIVE 且 outstanding\_amount \> 0 時，Wallet 發布 WalletNegativeBalanceOpened。 | 事件與 ledger entry 同交易 outbox；不得由批次隔日才同步。 |
| Tier Checkout Freeze | CRM / Tier module 接收事件後，member\_tier\_checkout 將 tier\_benefit\_status 設為 FROZEN\_NEGATIVE\_LEDGER，discount\_rate\_effective \= 1.00。 | Checkout 計價必須讀 member\_tier\_checkout 強一致投影；若凍結狀態存在，不得套用任何自有品牌折扣。 |
| NegativeLedgerCleared | 負數餘額被未來點數或人工補償全數結清後，Wallet 發布 WalletNegativeBalanceCleared。 | 解除凍結需重新計算 tier benefit；保留 audit log 與 before/after。 |
| Member Experience | 會員中心顯示「點數帳戶暫凍／需補足負點數」與恢復條件。 | 不得只在後台凍結而前台無可解釋狀態。 |
| **Checkout assertion:if member\_tier\_checkout.tier\_benefit\_status \== 'FROZEN\_NEGATIVE\_LEDGER':    discount\_rate\_effective \= 1.00    deny\_high\_value\_redemption \= trueThis rule must be evaluated before applying any self-brand discount.** |  |  |

## **39.4｜High-volume Fact Tables Physical Partitioning**

風險：qr.scan\_event、platform.event\_outbox、notification.send\_history 屬高量事實表；若 Codex 僅建立單表與一般索引，PUBLISHED outbox 與 scan event 會快速拖垮寫入與查詢。

| Table | Partition Strategy | PK / Unique Index Guardrail | Retention / Archive |
| :---- | :---- | :---- | :---- |
| qr.scan\_event | Range partition by month on scan\_timestamp\_utc。 | PK / unique indexes on this partitioned fact must include scan\_timestamp\_utc, e.g. (scan\_timestamp\_utc, scan\_event\_id). Do not enforce one-code-one-use here; qr.code state transition is the sole enforcement point. | All scan attempts are recorded as facts; scan\_event is not the enforcement table for code consumption. |
| platform.event\_outbox | Range partition by month on created\_at\_utc。 | Primary key 建議 (created\_at\_utc, event\_id)；idempotency 或 aggregate 查詢另建局部索引，但不得破壞分區裁切。 | PUBLISHED 且超過 retention 的分區以 DROP / DETACH PARTITION O(1) 清理。 |
| notification.send\_history | Range partition by month on sent\_at\_utc / created\_at\_utc。 | 查詢索引至少覆蓋 (member\_id, sent\_at\_utc), (template\_id, sent\_at\_utc), (market\_id, sent\_at\_utc)。 | 保留足以支援封鎖率歸因、同意證據與法規留存。 |
| **DDL assertion for partitioned facts:\- Partition key must be included in PK and unique indexes.\- event\_outbox cleanup must be partition-drop capable.\- New fact tables with expected monthly growth must declare partition plan before merge.** |  |  |  |

## **39.5｜Codex Final Engineering Assertions**

| Assertion | Blocking Rule | CI/CD Enforcement |
| :---- | :---- | :---- |
| No Float / Double | wallet、reward、compliance、money、points、probability 相關 code / DDL / migration / comments 不得出現 float 或 double 作為業務數值型態。 | Static scan fail build；唯一例外為測試中驗證 forbidden pattern 的字串。 |
| Cross-schema Write Ban | 除 platform.event\_outbox 外，任何非 owning context 的 SQL INSERT / UPDATE / DELETE 一律禁止。 | Static SQL scanner \+ repository ownership test。 |
| Cross-context Read Contract | 跨 context 讀取只能 SELECT FROM \*\_public.\* projection / view，或走 Domain Service interface。 | 禁止 production code 直接 join wallet.\* / reward.\* / crm.\* source tables。 |
| UTC-only Expiry | 帳本與到期判定不得使用 application local timezone。 | Static scan \+ unit tests for TW/JP midnight boundaries。 |
| Negative Ledger Freeze | Negative outstanding \> 0 時，checkout discount 必須被熔斷為無折扣。 | Integration test: negative ledger → tier freeze → checkout no discount → clear → benefit restored。 |
| Partitioned Facts | 高量 fact table DDL 必須含 monthly range partition 與包含 partition key 的 PK / unique index。 | Migration lint blocks unpartitioned scan\_event/outbox/send\_history。 |

## **39.6｜Final Blocking Test Cases**

* JP point lot expires exactly at expires\_at\_utc using DB server UTC; application local timezone manipulation is absent.  
* Member with outstanding NegativeLedgerEntry receives discount\_rate\_effective \= 1.00 at checkout, even if Contribution Tier is Legend.  
* After NegativeLedgerCleared, member\_tier\_checkout is recalculated and restored only through audited event flow.  
* qr.scan\_event and platform.event\_outbox DDL include monthly range partition and partition key in primary / unique indexes.  
* Outbox archival removes historical PUBLISHED data by dropping/detaching partitions, not row-by-row delete.  
* Codex-generated code fails CI when float/double appears in wallet, reward, compliance or money value object paths.

# **40｜Freeze Decision, Codex Release and Cutover Gate G0**

TDS v1.0 RevB Final is frozen as the implementation technical contract. No additional PRD/SAD scope is introduced. Further changes must be handled as Codex Spec task-level clarification, TDS errata, or ADR amendment depending on severity.

| Decision | Status | Instruction |
| :---- | :---- | :---- |
| TDS Freeze | Approved | RevB Final becomes the baseline for Codex Development Specification. |
| Codex Development Permission | Unlocked | PM and Tech Lead may decompose Chapter 33 backlog into executable prompt task packages. Each task must carry the engineering assertions in 37.4 and 39.5. |
| Cutover Gate G0 | Start Preparation | DevOps and Data teams start legacy identity, points, QR, consent and order history data cleaning scripts before pilot run. |
| No PRD Reopen | Frozen | The three final guardrails are implementation constraints, not new product scope. |

## **40.1｜Cutover Gate G0 Data Cleaning Preparation**

| Workstream | Required Preparation | Exit Criteria |
| :---- | :---- | :---- |
| Member Identity | Map legacy member IDs, LINE bindings, duplicate accounts and phone/email conflicts. | Duplicate rate and unresolved conflicts reported; merge policy approved. |
| Legacy Points | Extract historical point lots where available; if only balance exists, create migration\_expiry\_policy for Finance/Product approval. | Wallet opening lots reconcile to legacy total; no unexplained delta. |
| Legacy QR / Printed Inventory | Classify existing QR batches: legacy adapter, re-label, or sunset date. Confirm on-hand printed inventory. | G2 前 must decide old-vs-new flow; no active inventory without activation policy. |
| Consent / Notification | Migrate opt-in, LINE block state, email/SMS preferences and market\_id. | Preference Center baseline ready; no Level 3 marketing to unknown consent. |
| Historical Orders | Map order\_id, SKU, gross\_margin\_band, bridge\_weight candidates and refund status. | Contribution/Tier migration can be replayed and audited. |
| Finance Reconciliation | Prepare month-close report template for issued/redeemed/expired/breakage/negative ledger. | Finance signs off before enabling redemption in production. |

## **40.2｜Codex Prompt Package Minimum Required Context**

**Codex Release Rule：任何 task package 不得引用、複製或實作標註為 \[SUPERSEDED\] 的段落、表格或偽代碼。若 task context 必須提及歷史段落，需同時附上其 superseding section（36.1 / 37.5 / 39.5 / 41.x）與明確「不可實作」指示。**

| Every Codex task package must include:1\. Target module and owning schema.2\. Allowed dependency list and forbidden cross-schema references.3\. DDL constraints, indexes, partitioning requirements.4\. Event contracts and idempotency keys.5\. Engineering Assertions: no float/double, UTC-only expiry, negative ledger freeze, partitioned facts.6\. Acceptance tests and failure cases.7\. Migration/rollback instructions when schema changes are involved. |
| :---- |

## **40.3｜Final Conclusion**

RevB established the correct Phase 1 engineering baseline: DB-backed token with SKIP LOCKED, append-only Wallet PointLot, PendingGrant, strict event ordering, boundary enforcement, and CI/CD guardrails. This Final Addendum closes the last three implementation hazards: cross-market UTC expiry, negative ledger checkout freeze, and partition-safe high-volume fact tables. The document is now ready to hand off to Codex Development Specification and Cutover Gate G0 preparation.

*5min Coffee Platform 2.0 TDS v1.0 RevB Final｜Codex Handoff Approved｜Internal Engineering Contract*

# **41｜Codex Release Errata and Final Handoff Fixes**

本章處理 Codex Release 前四項必要 errata、一項 P1 精確化，以及 E1/E2 errata-of-errata。優先級：本章與 36.1 / 36.2 / 36.3 / 37.5 / 39.x 為 Codex Release 有效上下文；所有標註 \[SUPERSEDED\] 的舊段落不得被 AI Coding Agent 用作實作依據。

## **41.1｜H1：SUPERSEDED Context Hygiene for AI Coding Agent**

問題：人類讀者可理解「RevB 優先於 RevA」，但 AI Coding Agent 常以章節片段作為上下文。若第 20.1 舊偽代碼或第 13 章舊表格被單獨餵入 Codex，可能生成已被推翻的 memory TokenSource / reservationLayer.popToken 路徑。

| 位置 | 處理方式 | Codex 規則 |
| :---- | :---- | :---- |
| 20.1 舊抽獎偽代碼 | 就地標註 \[SUPERSEDED by 36.1 / 41.1\]。 | 不得實作 reservationLayer.popToken；Phase 1 只採 DB-backed SKIP LOCKED。 |
| 13 reward.prize\_token 舊語意 | 改寫為 Phase 1 DB-backed authoritative token source。 | memory TokenSource 僅為未來 ADR 路徑。 |
| 11.2 precision types | TW 金額定案 integer NTD，不再出現 decimal(18,4) or integer。 | wallet/reward/compliance money path 禁用 float/double，TW/JP 使用整數最小貨幣單位。 |
| 40.2 Codex prompt package | 新增禁止引用 SUPERSEDED 段落規則。 | 任何 task 若引用 superseded 內容，CI / reviewer 應退回。 |

## **41.2｜H2：scan\_event Partition Unique Key Errata**

裁決：一碼一用的唯一執法點是 qr.code 的原子狀態轉移，而不是 qr.scan\_event 的跨分區唯一鍵。scan\_event 是高量事實表，按 scan\_timestamp\_utc 月分區；PostgreSQL 分區表的唯一索引必須包含 partition key，因此不得用 unique(qr\_code\_id, idempotency\_key) 作為全域一碼一用執法。

Authoritative enforcement pseudocode:

\-- Successful consumption path: qr.code is the sole authoritative one-code-one-use enforcement point.  
BEGIN;  
  UPDATE qr.code  
     SET code\_state \= 'USED', used\_by\_member\_id \= :member\_id, used\_at\_utc \= DB\_UTC\_NOW()  
   WHERE qr\_code\_id \= :qr\_code\_id  
     AND code\_state \= 'ACTIVE';  
  IF affected\_rows \= 1 THEN  
     INSERT INTO qr.scan\_event(scan\_timestamp\_utc, scan\_event\_id, qr\_code\_id, idempotency\_key, code\_verify\_result='VALID\_USED', ...);  
     COMMIT;  
     RETURN SUCCESS;  
  END IF;  
ROLLBACK;

\-- Failure / duplicate path must still be recorded. Do not insert inside the rolled-back transaction.  
BEGIN;  
  INSERT INTO qr.scan\_event(scan\_timestamp\_utc, scan\_event\_id, qr\_code\_id, idempotency\_key, code\_verify\_result='ALREADY\_USED\_OR\_INACTIVE', ...);  
COMMIT;  
RETURN STATE\_CONFLICT;

| Object | Rule |
| :---- | :---- |
| qr.code | Sole authoritative one-code-one-use enforcement via atomic UPDATE ... WHERE state=ACTIVE. |
| qr.scan\_event | Partitioned fact table. PK/unique indexes include scan\_timestamp\_utc. Partition-local duplicate defenses are allowed but not authoritative. |
| Codex assertion | Do not implement global unique(qr\_code\_id, idempotency\_key) on partitioned scan\_event as the code consumption guard. |

## **41.3｜H3：Lot Rollback Worked Example**

裁決：rollback\_recent\_debits 不代表撤銷不相干的歷史兌換，也不代表追回已發放的實體獎品。正確語義是「重分配歷史 DEBIT 的 lot\_allocations」：將原本錯誤使用即將被 reversal 的 lot 額度，改由其他仍有效且可用的 active lots 承擔；若沒有可承擔的 active lot，才建立 Negative Ledger。

| Step | State / Action | Correct Accounting Result |
| :---- | :---- | :---- |
| 1\. Initial lots | Lot A: original=100, remaining=100, expires=2026-09-30, source=Order X. Lot B: original=100, remaining=100, expires=2026-10-31, source=Mission. | Total available=200. |
| 2\. Member redeems 80 points | FIFO consumes 80 from Lot A. Lot A remaining=20; Lot B remaining=100. Ledger has DEBIT allocation: A:-80. | Physical redemption remains valid; do not erase this redemption. |
| 3\. Order X is returned | Return reversal must remove the 100 points originally granted by Order X. Lot A has only 20 unconsumed. | Append REVERSAL \-20 against Lot A and set A remaining=0. |
| 4\. Reallocate consumed gap 80 | Find historical DEBIT allocation A:-80. Reassign that debit to other active lots in lock order; consume 80 from Lot B. | Lot B remaining becomes 20\. Redemption remains recorded, but its funding lot changes from A to B. |
| 5\. If no active lot can absorb gap | No sufficient B/other active balance exists. | Append NegativeLedgerEntry \-80. Do not set A.remaining above original\_points and do not create a new lot with reset expiry. |
| Invariant | remaining\_points \<= original\_points for every lot; ledger can rebuild all balances. | Daily reconciliation must pass with no physical-limit violation. |

## **41.4｜H4：Document Hygiene and Open Issue Retargeting**

Revision History 已修正為僅本 Errata 版標示為本版；TDS RevB 與 RevB Final 均標示為已併入。Open Issues 中 ADR-006 / ADR-007 不再指向 TDS RevB 自身，改列入 Codex-stage ADR track / implementation option。

## **41.5｜Optional Assertion：Checkout Double-check for Negative Ledger**

雖然 NegativeLedgerOpened 會透過 outbox 熔斷 member\_tier\_checkout，但為降低秒級傳播窗口，checkout pricing flow 可同步查 wallet.has\_outstanding\_negative\_flag。若 flag=true，即使 tier projection 尚未更新，discount\_rate\_effective 必須回傳 1.00。此項作為 Codex Optional P1 Assertion，不阻擋 release。

## **41.6｜Errata-of-Errata E1/E2 Applied**

E1：qr.code 原子狀態轉移失敗時，ALREADY\_USED\_OR\_INACTIVE scan\_event 必須在 rollback 後以獨立交易寫入，確保客服與風控可查詢第二次以上掃碼。E2：第 13 章 reward.draw\_ledger / reward.pity\_counter 舊表格已就地標註 SUPERSEDED；Reward epic 的 DDL task 必須引用 36.2 / 36.3，而非第 13 章原表。