**5min coffee**

**平台 2.0 系統架構設計書**

Software Architecture Document (SAD)｜Version 1.0 RevC.1 (Errata Applied)｜Architecture Review Blocking Resolution

| 項目 | 內容 |
| :---- | :---- |
| 文件版本 | SAD v1.0 RevC.1 |
| 文件日期 | 2026 年 7 月 |
| Owner | 5min coffee / Best Moment Inc. |
| 基礎文件 | 5min Coffee Platform 2.0 PRD v1.1 Final Rev D (Frozen for Architecture Review) |
| 主要讀者 | System Architect、Tech Lead、Backend / Frontend Lead、Data Lead、Security、QA、Codex / AI Coding Agent |
| 審查目的 | 將 PRD Rev D 已凍結的產品、財務、合規與治理需求轉化為可評審的架構邊界、事件流、資料一致性策略、ADR 決策清單，並收斂 Senior SA blocking feedback。 |

## **Revision History**

| 版本 | 變更摘要 | 狀態 |
| :---- | :---- | :---- |
| SAD v1.0 RevA | 首次依 PRD v1.1 Final Rev D 生成 Software Architecture Document。包含 C4 Context/Container、模組邊界、事件架構、核心資料一致性、Wallet/Reward/QR/Notification/Compliance/IP Asset/CRM/Team 架構與 ADR。 | 已併入 |
| SAD v1.0 RevB | 依 Senior SA Architecture Review 回饋加固：① Context Schema 隔離、Read Model / Domain Service API 走線與 CI 邊界檢查；② Reward 抽獎 BFF+Worker 雙重等冪、Queue Backpressure 與 DLQ Runbook；③ Compliance / Wallet 全面禁止 Float/Double，採高精度與最小貨幣單位；④ QR 雙層激活（Batch \+ Order/POS Linkage）、簽章失敗動態熔斷與 batch revoke；⑤ ADR-001/002/005/008 更新為 Accepted，ADR-003/004 進入 TDS 決策門。 | 已併入 |
| SAD v1.0 RevC | 依 Senior SA blocking feedback 補齊五項架構澄清：① 抽獎隨機性於 DrawReserved 時刻決定且 settlement 不改判；② 權杖保留 TTL 與分鐘級 sweep 防幽靈鎖定；③ Wallet point lot / FIFO / expiry 帳齡模型與遷移策略；④ pity counter 納入 Draw Ledger 同交易範圍；⑤ per-aggregate event ordering 與 version check。另補讀模型一致性分級、PendingGrant、邊界執行、容量模型、idempotency store owner 與 minor hooks。 | 已併入 |
| SAD v1.0 RevC.1 | Errata（Senior SA 基線核准附帶修正）：P1-1 判定與權杖保留原子性（權杖即結果模型）；P1-2 member\_tier 讀模型拆分為 checkout 強一致與 display 顯示用；P2 lot 回補語義、FraudReview 豁免 sweep、future-event buffer 上限、B2B 激活範圍閘門；PendingGrant 預設 reserved-by-pending；checklist 治理收斂（第 30 章為唯一有效清單）。 | 本版 |

# **0｜Executive Summary**

本 SAD 是 PRD Rev D 之後的第一份架構文件，目的不是再新增產品功能，而是將已凍結的需求轉成可被 System Architect 與 Tech Lead 評審的架構設計。

| 架構決策項 | RevA 建議 | 說明 |
| :---- | :---- | :---- |
| Architecture Style | Modular Monolith first, Service-ready boundaries | 初期以模組化單體降低交付風險；Reward、Wallet、Notification、Compliance 等保留未來服務化邊界。 |
| Core Data Truth | Relational DB \+ Append-only Ledger \+ Event Store | 交易、點數、庫存、抽獎結果以不可覆寫事實表與帳本為最終真相。 |
| Event Strategy | Event-driven core with transactional outbox | 訂單、掃碼、抽獎、點數、通知、合規檢核全部轉成內部標準事件。 |
| High Concurrency Draw | Reservation Layer \+ Queue \+ Settlement Worker | 權杖保留層只做高併發 reservation，DB Ledger / Inventory Fact 是最終真相。 |
| Compliance | Policy-driven Rule Engine | 台灣/日本差異透過 MarketCompliancePolicy 與 rule\_id 管理，不寫死於賞池程式。 |
| Notification | Single Notification Broker | 所有 LINE / Email / SMS 經 Broker，統一 consent、頻控、優先權、熔斷。 |
| Randomness Source | DrawReserved-time deterministic outcome | 抽獎結果於 DrawReserved 時刻依當下 probability\_version\_id 與 inventory\_snapshot\_id 決定；settlement 僅執行，不重新擲骰。 |
| Wallet Expiry Model | Append-only ledger \+ Point Lot \+ FIFO projections | 每筆入帳形成 point lot，扣抵與到期依 lot 順序處理；available\_balance 為強一致投影。 |
| Event Ordering | Per-aggregate partition \+ versioned consumers | 關鍵聚合事件需以 aggregate\_id 分區保序；consumer 仍需 idempotent 並檢查 aggregate\_version。 |
| Boundary Enforcement | Schema isolation \+ read contracts \+ CI fitness functions | 同一 RDBMS 內以 schema 隔離 bounded context；跨界讀取走 read model 或 domain API，CI 阻擋違規依賴。 |

## **0.1 Architecture Thesis**

| PRD Rev D Frozen Requirements   \-\> Platform Capabilities   \-\> Bounded Contexts   \-\> Event-Driven Architecture   \-\> SAD / ADR Decisions   \-\> TDS API, DB, Permissions, Queue, Monitoring   \-\> Codex Development Specification |
| :---- |

* 本 SAD 以 PRD Rev D 的 Frozen Scope 為唯一產品需求來源，不新增產品功能。  
* 本文件只做架構級設計：模組邊界、資料所有權、事件流、一致性、可靠性、安全性與 ADR。  
* 本文件不定義完整 API contract、資料庫 DDL、雲端資源細節或程式碼任務；這些進入 TDS / Codex Spec。  
* 所有核心能力均需可配置、可稽核、可回放、可觀測，避免每檔 IP 重新開發。

# **1｜Source PRD Traceability**

本章將 PRD Rev D 的凍結需求映射至 SAD 架構章節，確保架構設計可追溯。

| PRD Rev D 需求域 | SAD 對應章節 | 架構責任 |
| :---- | :---- | :---- |
| Platform Capability Map | 2, 3, 4 | 將 Campaign、QR、Reward、Collection、Mission、CRM、Notification、Analytics 轉為 bounded contexts。 |
| 雙軌帳本與財務防線 | 7 Wallet / Ledger Architecture | 定義 point\_source、bridge\_weight、negative ledger、breakage、reconciliation。 |
| QR 碼安全與風控 | 9 QR / Supply Chain Architecture | 定義簽章、批次、activation、撤銷、掃碼事件與風控。 |
| Reward 高併發與公平稽核 | 8 Reward Engine Architecture | 定義 reservation、queue、settlement、audit log、probability snapshot。 |
| Notification Broker | 10 Notification Architecture | 所有訊息經 Broker，統一 consent、priority、frequency、cooldown。 |
| Compliance Rule Engine | 11 Compliance Architecture | 市場別 rule engine、publish gate、approval、audit。 |
| IP Asset 生命週期 | 12 IP Asset Policy Architecture | signed URL / policy engine 候選、CDN purge、fallback、license expiry。 |
| Member Tier / Team Synergy | 13 CRM / Member / Team Architecture | Contribution Tier、Health Score、Team Score vesting 與折扣權益整合。 |
| Dashboard / Incident Runbook | 14, 18 | 近即時/批次/週月報、告警、Owner/SLA/解除條件。 |
| ADR Candidate | 20 ADR | 將 8 項 PRD ADR Candidate 轉化為 SAD 評審決策。 |

## **1.1 SAD Scope**

* 定義 C4 Context、Container、主要 Components 的邏輯邊界。  
* 定義核心資料所有權與資料一致性策略。  
* 定義核心事件流、事件命名原則、event outbox / retry / DLQ 的架構要求。  
* 定義 Wallet、Reward、QR、Notification、Compliance、IP Asset、CRM/Team、Dashboard 架構。  
* 產出 ADR-001 至 ADR-008 的建議決策與未決問題。

## **1.2 Out of Scope**

* 完整 API request / response schema。  
* 完整資料庫 DDL、索引、partition、migration scripts。  
* UI wireframe、視覺設計、前端元件規格。  
* 雲端供應商與產品級資源清單。  
* Codex 可直接執行的任務拆解。

# **2｜Architecture Principles**

本章將 PRD 的平台原則轉成系統架構原則。

| 原則 | 架構要求 | 不可接受的反模式 |
| :---- | :---- | :---- |
| Everything is a Campaign | 所有 IP、任務、賞池、通知、圖鑑均掛 campaign\_id 與 market\_id。 | 為單一 IP 寫死頁面、機率、素材規則。 |
| Everything is Configurable | 權重、機率、保底、頻控、合規參數、Tier 權益存在設定表並有審計。 | 把數值寫死於程式碼，營運改檔期需工程部署。 |
| Everything Generates Events | 所有核心行為產生 domain event，進 outbox/event store。 | 模組直接互相修改資料，CRM/Dashboard 只能抓表猜狀態。 |
| Everything is Measurable | 核心事件需有 correlation\_id、source、timestamp、status。 | 追蹤事件命名不一致，GA4、DB、LINE 無法對帳。 |
| Compliance is Enforced by Code | 發布前由 rule engine 檢核，超限阻擋且留審計。 | 依人工記憶確認景品/點數/素材規則。 |
| Ledger is Truth | 點數、抽獎、庫存、戰隊分數以 append-only ledger/fact 表為最終真相。 | 只存 balance 或直接覆寫 result。 |
| Broker over Direct Send | 任何 LINE/Email/SMS 不允許功能模組直發。 | 各模組各自觸發推播，造成疲勞轟炸。 |

# **3｜Candidate Target Architecture**

RevA 建議採模組化單體優先，清楚切出未來可服務化的 bounded contexts。具體是否微服務化由 ADR-001 決策。

## **3.1 Architecture Style Recommendation**

| 選項 | RevA 評估 | 建議 |
| :---- | :---- | :---- |
| Modular Monolith | 最適合 Phase 0-2。共用資料庫交易可降低 Wallet/Reward/Order 一致性風險，部署簡單。 | 推薦作為初期架構。 |
| Microservices | 有利於擴展與團隊分工，但初期會增加分散式交易、部署、監控成本。 | 保留未來拆分路徑，不作第一版預設。 |
| Hybrid | Reward/Wallet/Notification/Compliance 可先是獨立 module，未來按負載或法規獨立服務化。 | 作為 architecture runway。 |

| Recommended RevA StyleWeb / Mobile / LINE LIFF        |        vBFF / API Layer        |        vModular Application Core  \- Campaign Module  \- Member / CRM Module  \- Wallet Ledger Module  \- QR Module  \- Reward Module  \- Collection / Mission Module  \- Notification Broker Module  \- Compliance Rule Module  \- Analytics / Dashboard Module        |        vRelational DB \+ Event Store \+ Object Storage \+ Cache/Reservation \+ Queue |
| :---- |

## **3.2 Deployment View (Logical)**

| Container | Responsibility | Scaling Driver |
| :---- | :---- | :---- |
| Web Frontend | 官網、IP Landing、會員中心、點數商城、典藏館。 | 流量、SEO、檔期高峰。 |
| Admin / CMS | Campaign、素材、賞池、機率、規則、合規參數、Dashboard。 | 營運操作與審批流程。 |
| BFF / API | 統一前台與 LINE LIFF API，處理 session、auth、idempotency。 | 前台流量與掃碼/抽獎峰值。 |
| Application Core | 核心 domain modules 與 transaction boundary。 | 交易量、事件吞吐。 |
| Worker Pool | Outbox publish、reward settlement、notification dispatch、reconciliation。 | 非同步事件量。 |
| Data Stores | RDBMS、event store、cache/reservation、object storage、warehouse。 | 資料量、查詢、對帳、報表。 |

# **4｜C4 Context Model**

描述 5min Platform 2.0 與外部使用者及第三方系統之關係。

| C4 Context\[Customer / Member\]   | Web, Mobile, QR Scan, LINE LIFF   v\[5min Coffee Platform 2.0\]   |-- Payment Gateway   |-- Logistics / Warehouse / ERP   |-- LINE OA / Messaging API   |-- Email / SMS Provider   |-- GA4 / GTM / Meta Pixel   |-- CDN / Object Storage   |-- Admin Users: Ops, CRM, Legal, Finance, IP OwnerKey External Actors\- Member: buy, scan, draw, collect, redeem, join team.\- Ops: configure campaign, SKU, prize, QR batch, mission.\- Finance: wallet reconciliation, breakage, reward budget.\- Legal/IP Owner: compliance policy, license lifecycle, approvals.\- System/Tech: monitoring, incident response, ADR decisions. |
| :---- |

| 外部系統 | 整合方向 | 架構關注 |
| :---- | :---- | :---- |
| Payment Gateway | 雙向：payment request / callback / refund / chargeback。 | 訂單狀態、Wallet/Team 反向扣回、一致性。 |
| Logistics / Warehouse / ERP | 雙向：出貨、取貨、庫存、兌換獎品物流狀態。 | Team Confirmed、N+14、prize\_item\_id 不超賣。 |
| LINE OA / LIFF | 雙向：會員綁定、推播、點擊、封鎖歸因。 | Notification Broker 必須是唯一出口。 |
| Email / SMS | 輸出為主：備援通知、交易通知、法規需要。 | Consent / Preference / fallback。 |
| GA4 / Pixel | 輸出與分析：行為追蹤、campaign attribution。 | 事件命名與 DB event 對齊。 |
| CDN / Object Storage | 素材、圖鑑、分享卡、OG 圖。 | IP license expiry、signed URL、cache purge。 |

# **5｜C4 Container Model**

容器圖定義系統主要可部署單元與資料存放位置。

| C4 Container\[Web Frontend / LIFF\]        | HTTPS        v\[BFF / API Gateway\]        | auth, idempotency, rate limit        v\[Application Core\]        |-- Campaign Module        |-- QR Module        |-- Reward Module        |-- Wallet Ledger Module        |-- Collection / Mission Module        |-- CRM / Member Tier Module        |-- Team Module        |-- Notification Broker Module        |-- Compliance Rule Module        |-- Admin / CMS Module        |        | transactional writes        v\[Relational DB\]        | append domain events        v\[Outbox / Event Store\] \--\> \[Worker Pool\] \--\> \[Queue / DLQ\]        |                                  |        |                                  \+--\> LINE / Email / SMS        |                                  \+--\> Data Warehouse / BI        |                                  \+--\> Reconciliation Jobs        \+--\> \[Cache / Reservation Layer\]        \+--\> \[Object Storage / CDN\] |
| :---- |

| Container | Owns | Does Not Own |
| :---- | :---- | :---- |
| BFF / API Gateway | Auth session, request validation, idempotency key enforcement, coarse rate limit. | Business rules or final ledger writes. |
| Application Core | Domain rules, transactions, outbox events, module boundaries. | Direct third-party push without adapters/brokers. |
| Worker Pool | Asynchronous settlement, notification dispatch, reconciliation, report generation. | User-facing synchronous decisions without idempotency. |
| Relational DB | Orders, ledger, inventory fact, member state, campaign config, policy config. | Long-term analytical aggregates only. |
| Event Store / Outbox | Domain events, event status, retry, correlation. | Replacing source-of-truth ledger. |
| Cache / Reservation Layer | Short-lived reservations, high-concurrency draw token reservations. | Financial or inventory final truth. |
| Data Warehouse / BI | Dashboard, cohort, health score analysis, weekly/monthly reports. | Operational transaction authority. |

# **6｜Bounded Contexts and Module Boundary**

此章定義領域邊界、資料擁有權與上下游依賴。

| Bounded Context | Owns | Primary IDs | Depends On / Publishes To |
| :---- | :---- | :---- | :---- |
| Campaign | Campaign、Market、IP License、SKU association、rule windows。 | campaign\_id, market\_id, license\_id。 | Product/Inventory, Reward, Collection, Notification, Compliance。 |
| Member / CRM | Member profile、LINE binding、Lifecycle Segment、Health Score、Contribution Tier。 | member\_id, current\_state, tier, grade。 | Order, QR, Wallet, Collection, Team, Notification。 |
| Wallet Ledger | Point source, balance view, ledger events, expiry, breakage provision, negative ledger。 | wallet\_ledger\_id, point\_source, ledger\_event\_type。 | Order, Reward, Refund, Team, Finance Report。 |
| QR | QR batch, code signature, activation, scan event, risk signal。 | qr\_code\_id, qr\_batch\_id, code\_verify\_result。 | Campaign, Reward, Wallet, Risk, Analytics。 |
| Reward | Prize pool, probability version, draw, reservation, prize grant, pity/last one。 | draw\_id, prize\_pool\_id, probability\_version\_id。 | Wallet, Inventory, Compliance, Notification。 |
| Collection / Mission | Collection item, badge, mission progress, completion reward。 | collection\_item\_id, mission\_id。 | Reward, Notification, Member。 |
| Team | Team, referral, pending/confirmed/frozen/reversed score, team role。 | team\_id, team\_score\_event\_id。 | Member, Order, Wallet, Reward, Dashboard。 |
| Notification | Template, priority, consent, broker decision, delivery attribution。 | notification\_id, template\_id。 | Member, LINE, Email, SMS, Dashboard。 |
| Compliance | Market policy, rule domain, rule version, approval, blocking result。 | compliance\_policy\_id, rule\_id。 | Campaign, Reward, Wallet, IP Asset。 |
| IP Asset Policy | Asset, license scope, visibility policy, resolution, CDN purge。 | asset\_id, license\_policy\_id。 | Campaign, Collection, Frontend/CDN。 |
| Analytics / Dashboard | Operational metrics, event views, incident alerts, reports。 | dashboard\_view\_id, metric\_name。 | All domains via events/warehouse。 |

## **6.1 Dependency Rule**

* 跨模組不可直接寫入對方 source-of-truth table；需透過 domain service 或 domain event。  
* Financial and inventory state changes must emit audit events and be traceable by correlation\_id。  
* Notification Broker 是所有 outbound communication 的唯一出口。  
* Compliance Rule Engine 是 Campaign / Reward / Wallet publish 或 enable 的前置檢核。

# **7｜Event Architecture**

PRD Rev D 的核心是事件鏈。本章定義 event-driven 風格、事件分類與處理保證。

## **7.1 Event Flow Overview**

| Synchronous pathUser Request \-\> API \-\> Domain Service \-\> DB Transaction \-\> Outbox EventAsynchronous pathOutbox Publisher \-\> Queue \-\> Worker \-\> Side Effect / Projection / NotificationExamplesOrderCompleted \-\> BridgeCreditCalculated \-\> WalletLedgerPostedQRCodeScanned \-\> CodeVerified \-\> DrawRequested \-\> DrawReservedPrizeGranted \-\> CollectionUpdated \-\> NotificationRequestedTemplateBlocked \-\> MessagingCircuitBreakerActivated |
| :---- |

| Event Class | Purpose | Examples | Delivery Requirement |
| :---- | :---- | :---- | :---- |
| Domain Event | 描述核心狀態變更。 | OrderCompleted, QRCodeScanned, DrawReserved, PrizeGranted, WalletLedgerPosted。 | At least once; consumer idempotent。 |
| Integration Event | 對第三方或其他容器發送。 | PaymentCaptured, ShipmentDelivered, LINEMessageDelivered。 | Retry \+ DLQ。 |
| Audit Event | 不可覆寫稽核紀錄。 | AdminRuleChanged, ManualWalletAdjustmentRequested, CompliancePolicyApproved。 | Append-only, immutable。 |
| Analytics Event | 行為與指標。 | CampaignViewed, ProductViewed, CollectionViewed, NotificationClicked。 | Near-real-time or batch。 |
| Incident Event | 熔斷與告警。 | RewardInconsistencyDetected, InvalidCodeSpikeDetected, MessagingCircuitBreakerActivated。 | Immediate alert。 |

## **7.2 Event Envelope**

| Field | Required | Description |
| :---- | :---- | :---- |
| event\_id | Y | Globally unique event id. |
| event\_type | Y | Domain event name, e.g. QRCodeScanned. |
| occurred\_at | Y | Business time of event occurrence. |
| published\_at | N | Time the event leaves outbox. |
| aggregate\_type / aggregate\_id | Y | Source aggregate. |
| correlation\_id | Y | Trace one user flow across modules. |
| causation\_id | N | Previous event or command id. |
| source\_module | Y | Module that emitted the event. |
| market\_id / campaign\_id | N | Required for campaign-related events. |
| payload\_version | Y | Schema version for backward compatibility. |
| idempotency\_key | N | Required for user initiated commands/draw/scan. |

# **8｜Wallet / Ledger Architecture**

Wallet 是準金融帳本，不是會員附屬功能。點數、券、抽獎券、negative ledger、breakage 均須可對帳。

## **8.1 Wallet Model**

| Wallet ArchitectureCommands\- GrantPoints\- ReversePoints\- FreezeVoucher\- RedeemPoints\- ExpirePoints\- EstimateBreakageAppend-only Ledger\- wallet\_ledger\_event\- source\_type: scan | mission | purchase | compensation | reversal | expiry\- point\_source: free | paid | mixed\- liability\_type: deferred | revenue | no\_liabilityRead Models\- available\_balance\- frozen\_balance\- expiring\_soon\- negative\_ledger\_amount\- breakage\_provision |
| :---- |

| Architectural Requirement | Design Implication | TDS Detail Needed |
| :---- | :---- | :---- |
| Append-only ledger | Balance is a projection, not the source of truth. | Ledger table, balance projection, reconciliation query. |
| point\_source split | Japan-ready free/paid points from Phase 1\. | Schema and usage restrictions. |
| Negative ledger | Used points reversed after refund create negative obligations. | Front-end display and redemption block rules. |
| Breakage provision | Unscanned QR estimated as deferred liability. | Financial report and monthly close jobs. |
| Maker-checker approval | High-value manual adjustment requires two approvals. | Admin permission matrix. |

## **8.2 Wallet Consistency**

* WalletLedgerPosted and WalletBalanceProjected must be reconciled at least daily. Critical inconsistency triggers Incident: Reward/Wallet 不一致。  
* 任何退貨、chargeback、fraud reversal 必須 emit ReturnCompleted / ChargebackConfirmed，再由 Wallet module 處理 reversal。  
* Wallet consistency target: 100%。任何差異不得自動忽略，需進 incident runbook。

# **9｜Reward Engine Architecture**

Reward Engine 需同時支援掃碼開獎、點數抽獎與盲盒兌換，並防止超賣與後台操控。

## **9.1 Draw Sequence**

| Draw Sequence1\. User submits draw request with client\_request\_id2\. API validates campaign, member, market, compliance, risk3\. Idempotency check4\. Reservation Layer atomically reserves prize token5\. DrawReserved event written to DB/outbox6\. Queue receives settlement job7\. Worker writes Draw Ledger and Inventory Fact8\. Fraud/risk checks finish9\. PrizeGranted event emitted10\. Wallet / Collection / Notification projections update |
| :---- |

| State | Meaning | Allowed Next States |
| :---- | :---- | :---- |
| Requested | User initiated draw command accepted for validation. | DrawReserved, ReservationFailed, FraudReview。 |
| DrawReserved | Prize token reserved; user must not redraw. | SettlementPending, ReservationExpired, FraudReview。 |
| SettlementPending | DB ledger/inventory settlement in progress. | FraudPassed, CompensationRequired。 |
| FraudPassed | Risk checks passed and inventory confirmed. | PrizeGranted。 |
| PrizeGranted | Prize is granted and visible to member. | FulfillmentRequested, NotificationRequested。 |
| ReservationFailed | No token or invalid condition. | Show sold out or fail reason. |
| CompensationRequired | Reservation or settlement inconsistency. | Manual/automatic compensation workflow. |

## **9.2 Fairness and Audit**

* Each draw must lock probability\_version\_id and inventory\_snapshot\_id.  
* Admin cannot directly assign a member a winning result; compensation must go through compensation case with maker-checker.  
* random\_seed\_hash and token\_id\_hash are stored for audit but do not reveal secrets or allow reverse engineering.  
* Frontend probability disclosure version must be traceable to backend probability\_version\_id.

# **10｜QR Code and Supply Chain Architecture**

QR 是實體商品到數位會員資產的入口。安全防線需涵蓋碼生成、印刷、出貨、啟用、掃碼與撤銷。

| Stage | Architecture Requirement | Risk Controlled |
| :---- | :---- | :---- |
| Generate | Signed, non-enumerable code value with key\_version and batch\_id. | Prevent brute-force code guessing. |
| Print / Vendor | Each QR batch tagged with printer\_id and export audit. | Detect supply-chain leakage. |
| Warehouse / Shipping | QR batch remains inactive until authorized activation milestone. | Prevent pre-shelf scanning. |
| Activation | Batch or SKU-level activation after inbound/outbound event. | Control channel-specific launch. |
| Scan | Verify signature, batch status, one-time use, risk thresholds. | Prevent duplicate/invalid use. |
| Revoke | Batch revocation for leaked batches; code\_verify\_result records revoked status. | Contain leakage without affecting other batches. |

| QR Supply Chain Event FlowQRBatchCreated \-\> QRBatchExportedToPrinter \-\> QRBatchPrinted \-\> QRBatchReceived \-\> QRBatchActivated \-\> QRCodeScanned \-\> CodeVerified \-\> PointGranted / DrawRequestedException FlowInvalidCodeAttempt \-\> RiskSignalRaisedQRBatchLeakSuspected \-\> QRBatchRevoked \-\> ScanBlocked |
| :---- |

## **10.1 QR Risk Signals**

* signature verification failure rate by source IP/device/geo.  
* same member/device/IP scan velocity threshold breaches.  
* scan before activation or from unexpected geography/channel.  
* repeated scans on already-used code by different accounts.

# **11｜Notification Broker Architecture**

通知系統是 CRM 觸達資產的保護閘門。任何功能模組不得直接推 LINE / Email / SMS。

| Notification Broker FlowDomain Event  \-\> Notification Request  \-\> Consent & Preference Check  \-\> Member State Read  \-\> Priority Ranking  \-\> Global Frequency Cap  \-\> Cooldown Window  \-\> Channel Selection  \-\> Template Render  \-\> Delivery Adapter  \-\> Delivery / Click / Block Attribution |
| :---- |

| Component | Responsibility | Key Data |
| :---- | :---- | :---- |
| Notification Request API | Accepts requests from modules, validates priority and template. | notification\_request\_id, event\_id, member\_id. |
| Policy Evaluator | Consent, frequency cap, cooldown, level rules. | member\_preferences, send\_history, priority. |
| Scheduler / Buffer Queue | Delay, merge, expire low-priority messages. | scheduled\_at, expiry\_at, suppression\_reason. |
| Channel Adapter | LINE, Email, SMS delivery and fallback. | channel, provider\_message\_id. |
| Attribution Collector | Open/click/block/conversion attribution back to template\_id. | template\_id, campaign\_id, block\_reason. |

## **11.1 Broker Non-Bypass Rule**

* All modules publish NotificationRequested events; only Notification Broker can call external messaging providers.  
* Level 1 transactional/service messages may bypass marketing cooldown but not duplicate suppression.  
* Level 3 marketing messages are first to be suppressed under circuit breaker.  
* Every delivered message must have template\_id and correlation\_id for attribution and incident analysis.

# **12｜Compliance Rule Engine Architecture**

Compliance Rule Engine enforces market-specific rules before publishing campaigns, prize pools, point rules, and IP assets.

| Rule Domain | Core Inputs | Outputs | Owner |
| :---- | :---- | :---- | :---- |
| Market Scope | country\_code, market\_id, currency, locale, minor\_protection\_flag. | PASS/BLOCKED \+ missing params. | Product \+ Legal |
| General Lottery JP | transaction\_value, prize\_values, expected\_sales, probability\_distribution. | EV limit pass/fail. | Legal \+ Ops |
| General Premium JP | transaction\_value, premium\_value, premium\_type. | 総付景品 limit pass/fail. | Legal \+ Finance |
| Payment Services Act JP | point\_source, paid/free points, top-up, point+cash. | Enable/disable policy. | Legal \+ Finance |
| IP License Policy | license\_start/end, usage\_scope, resolution\_limit, post\_campaign\_visibility. | Asset visibility rule. | IP Owner |

| Publish GateAdmin saves config  \-\> Draft state  \-\> ComplianceCheckRequested  \-\> Rule Engine evaluates MarketCompliancePolicy  \-\> PASS: Config becomes Publishable  \-\> BLOCKED: show rule\_id, violated\_value, allowed\_value, required\_approverAll changes to compliance params require Legal \+ Business approval. |
| :---- |

## **12.1 Rule Engine Boundary**

* The rule engine must not contain hard-coded Taiwan-only logic.  
* Compliance policy is versioned; campaign publish records policy\_version\_id.  
* Copying a TW prize pool to JP must re-run all JP compliance rules.  
* Whether this engine is an independent service is an ADR-008 decision.

# **13｜IP Asset Policy Architecture**

IP assets carry licensing risk. Architecture must ensure true expiry enforcement, not only CMS hiding.

| Asset Type | Policy Dimensions | Architecture Control |
| :---- | :---- | :---- |
| Product Visual | market, channel, resolution, active/archive visibility. | Asset metadata \+ CDN cache purge \+ fallback image. |
| Collection Character Image | unlocked member visibility, low-res archive, silhouette allowed. | Policy evaluator at image URL and page render. |
| Draw Animation | active period, post-campaign use, shareability. | Expiration job disables rendering and removes OG references. |
| Share Card / OG Image | new generation allowed? old shared links behavior. | Signed URL \+ fallback page. |
| VTuber / Live Material | character-level, time-window, market-specific rights. | Asset policy at character and market level. |

* IP asset access should be evaluated by asset\_id \+ member\_id \+ campaign\_status \+ license\_policy\_id.  
* When license expires, scheduled job must purge CDN, disable new share card generation, and update OG fallback.  
* Existing unlocked collections may show low-resolution assets only if post\_campaign\_visibility is true.  
* Signed URL / policy engine decision is ADR-007.

# **14｜CRM, Member Tier, and Team Architecture**

會員治理需整合 Lifecycle Segment、Health Score、Contribution Tier、Team Score、Risk/Return Status。

| Member State ProjectionEvents:OrderCompleted, QRCodeScanned, MissionCompleted, CollectionUnlocked, LINEClicked, LINEBlocked, ReturnCompleted, ChargebackConfirmedNightly / Near-real-time Projections:\- Lifecycle Segment\- Health Score / Retention Grade\- Contribution Score / Tier\- Team Pending/Confirmed/Frozen/Reversed\- Risk StatusConsumers:CRM Scripts, Notification Broker, Member Center, Dashboard, Team Ranking |
| :---- |

| State | Source of Truth | Update Mode |
| :---- | :---- | :---- |
| Lifecycle Segment | Member projection from order/scan events. | Nightly batch \+ temporary flags. |
| Health Score | Weighted formula from events and profile. | Nightly batch, weights from config. |
| Contribution Tier | Contribution score \+ grade rule \+ legacy grandfathering. | Nightly batch; event-driven temporary status. |
| Team Score | Team score ledger events. | Near-real-time pending, confirmed after settlement window. |
| Risk Status | Risk rules and manual review. | Event-driven. |

## **14.1 Tier Migration Architecture**

* Existing 365-day discount tiers migrate to Contribution Tier with grandfathering state and expiry date.  
* Tier benefit is a projection; discount engine reads current effective benefit from TierBenefitProjection.  
* Phase 1-2: Bean/Roaster/Legend simplified projection; Phase 3 expands to six levels without reducing existing rights.  
* All weight and threshold parameters are config, not code constants.

# **15｜Dashboard and Analytics Architecture**

Dashboard has three speeds: near-real-time operations, daily batch analytics, weekly/monthly management reporting.

| Dashboard | Latency | Data Source | Purpose |
| :---- | :---- | :---- | :---- |
| Campaign War Room | Minutes | Event views \+ order/QR/reward streams. | 檔期作戰：銷售、掃碼、賞池、Last One。 |
| Platform Health | Minutes | API/Event/Queue/Reward/Wallet metrics. | 架構健康與熔斷。 |
| CRM Segment | Daily | Warehouse \+ projections. | 六層分群、遷移矩陣、Health Score。 |
| Finance / Wallet | Daily / Month close | Ledger \+ reconciliation reports. | 點數發行、兌換、失效、breakage、負債。 |
| Team / Tier | Near-real-time \+ daily | Team score ledger \+ member projections. | 戰隊 pending/confirmed、Tier migration。 |

## **15.1 Metrics Ownership**

* Business dashboard reads from warehouse/read models, not directly from transactional write tables.  
* Platform Health metrics are emitted by application, workers, queue, DB reconciliation jobs.  
* Critical alerts route to Incident Runbook owners; alerts without Owner/SLA are not accepted.

# **16｜Integration Architecture**

外部整合需先轉為內部標準事件，避免平台邏輯綁死第三方格式。

| Integration | Adapter Responsibility | Canonical Events |
| :---- | :---- | :---- |
| Payment Gateway | Normalize payment, refund, chargeback callbacks. | PaymentCaptured, RefundCompleted, ChargebackConfirmed. |
| Logistics / Warehouse / ERP | Normalize shipment, pickup, inventory fulfillment. | ShipmentCreated, ShipmentDelivered, PickupConfirmed, PrizeFulfilled. |
| LINE OA / LIFF | Bind LINE ID, deliver messages, collect delivery/click/block. | LineBound, NotificationDelivered, NotificationBlocked, NotificationClicked. |
| Email / SMS | Fallback communication and service notices. | EmailDelivered, SmsDelivered, DeliveryFailed. |
| GA4 / Pixel | Receive front-end behavior mapping and export event naming. | CampaignViewed, ProductViewed, AddToCart, Purchase. |
| Object Storage / CDN | Asset upload, signed access, purge, fallback. | AssetPublished, AssetExpired, AssetPurged. |

## **16.1 Integration Failure Strategy**

* External callbacks must be idempotent and retriable.  
* Payment/refund/chargeback events take priority over marketing workflows.  
* If LINE is blocked or unavailable, transactional messages should fallback to Email/SMS when allowed.  
* Third-party webhook payloads are stored raw for audit but translated to canonical events for domain processing.

# **17｜Security, Privacy, and Audit Architecture**

本平台涉及會員行為、掃碼、地理訊號、點數、抽獎、IP 素材與日本法遵，需以最小權限與可稽核為設計前提。

| Security Area | Architecture Control | SAD/TDS Follow-up |
| :---- | :---- | :---- |
| Authentication | Member auth \+ LINE binding; Admin RBAC. | SSO/MFA requirement for admin. |
| Authorization | Role-based access; domain-specific permissions. | Permission matrix in TDS. |
| Audit Log | Admin changes, wallet adjustments, compliance approvals, reward compensation. | Append-only audit schema. |
| PII minimization | geo\_location coarse-level only; IP/device use for risk. | Privacy notice and retention policy. |
| Secrets / Keys | QR signing keys, provider credentials, rotation. | Key management and rotation plan. |
| Data Retention | Events, ledger, scan data, message attribution. | Retention schedule by market. |
| Fraud/Risk | Scan thresholds, team abuse, reward review queue. | Risk scoring rules and review UI. |

# **18｜Observability and Incident Management**

Rev D 已定義 Incident Runbook，本 SAD 定義監控面與追蹤要求。

| Signal | Metric | Alert / Runbook |
| :---- | :---- | :---- |
| Event Pipeline | event ingestion delay, queue depth, DLQ count. | Delay \> 5 min pauses event-triggered marketing. |
| Reward / Wallet | ledger mismatch, duplicate prize\_item\_id, compensation count. | Freeze pool and reconciliation. |
| QR Security | invalid code failure rate, revoked batch scans, velocity breaches. | Risk escalation / batch revoke. |
| Notification | block rate, send rate, buffer expiration, template-level suppression. | Pause Level 3 messaging. |
| Compliance | blocked publish attempts, policy change approvals. | Legal/Product review. |
| IP Assets | expired asset served, CDN purge failed, fallback served. | IP Owner / Ops runbook. |
| System | API error rate, latency, DB lock, worker retries. | Tech Lead incident. |

* All user-facing flows must propagate correlation\_id from request to events, logs, worker jobs and notifications.  
* All critical events should be searchable by member\_id, campaign\_id, draw\_id, qr\_code\_id, order\_id where applicable.  
* Runbook ownership follows PRD Rev D: CRM Owner, Tech Lead, Finance Ops, Legal/Product, IP Owner as relevant.

# **19｜Migration Strategy**

從現有 1.0 電商與會員系統遷移至 2.0 平台能力，需避免中斷會員權益與既有訂單服務。

| Migration Area | Approach | Key Risk |
| :---- | :---- | :---- |
| Member Identity | Map existing e-commerce member ID to new member\_id. Keep legacy id. | Duplicate accounts and LINE binding conflicts. |
| Discount Tier | Migrate 365-day spend to Contribution Tier with grandfathering. | 权益縮水認知與客服爭議。 |
| Points | Import existing points into Wallet Ledger as opening balance event. | Balance mismatch, expiry unclear. |
| Historical Orders | Create read-only order history and derive initial contribution metrics. | Incomplete SKU margin/bridge\_weight. |
| Existing QR | Tag legacy QR batch; decide whether it uses old scan flow or new verification. | Legacy code format may not be signed. |
| Campaign Content | Migrate active IP to Campaign model with license policy fields. | License rules missing at asset level. |
| Notification Consent | Create initial consent/preferences based on existing opt-in data. | Over-messaging risk. |

## **19.1 Migration Cutover Principle**

* Phase 0 should not change customer-facing economics except required bug fixes and member center integration.  
* Wallet migration requires finance reconciliation before enabling redemption in 2.0.  
* Legacy discount tier migration must be customer-friendly: just high not low, 365-day grandfathering.  
* Old QR support must be explicitly decided; signed QR applies to new batches from Phase 1 onward.

# **20｜Architecture Decision Records (ADR)**

PRD Rev D 提供 ADR Candidate，本 SAD RevA 將其轉為可評審的決策清單。

| ADR | Decision Topic | RevA Recommendation | Decision Gate |
| :---- | :---- | :---- | :---- |
| ADR-001 | Modular Monolith vs Microservices | RevA Recommendation: Modular Monolith first with service-ready boundaries. | Architecture Review |
| ADR-002 | Wallet Ledger event sourcing level | Recommendation: Append-only ledger \+ projections; full event sourcing optional. | SAD/TDS |
| ADR-003 | Reward transaction boundary and reservation technology | Recommendation: reservation layer \+ queue \+ DB final truth; product selection in TDS. | Architecture Review |
| ADR-004 | QR activation milestone | Recommendation: inactive until warehouse/shipping activation milestone; support batch revoke. | Architecture Review |
| ADR-005 | Notification Broker as only outbound channel | Recommendation: yes; no direct module sends. | Architecture Review |
| ADR-006 | Dashboard BI vs custom | Recommendation: BI for management dashboards; custom campaign war room if needed. | SAD |
| ADR-007 | IP Asset signed URL \+ policy engine | Recommendation: policy-evaluated asset access, signed URL for sensitive assets. | Architecture Review |
| ADR-008 | Compliance Rule Engine service boundary | Recommendation: module first, extract if multi-market complexity increases. | SAD |

## **20.1 ADR Format for Next Step**

* Context: which PRD requirement and risk drives the decision.  
* Options: at least 2 alternatives, with pros/cons.  
* Decision: chosen option and reasons.  
* Consequences: cost, complexity, migration, operational impact.  
* Status: Proposed / Accepted / Superseded.

# **21｜Non-Functional Requirements**

本章將 PRD 的隱含技術要求轉為 SAD 級非功能性需求。

| NFR | Target / Principle | Notes |
| :---- | :---- | :---- |
| Availability | Core commerce and scan/draw flows should be designed for high availability during IP campaigns. | Detailed SLA in TDS. |
| Latency | QR scan/open result target: 3 seconds user-facing; event ingestion target \<5 minutes. | Draw may show processing for high-value rewards. |
| Consistency | Wallet/Reward/Inventory consistency must be 100% after reconciliation; no oversell allowed. | Use idempotency and ledgers. |
| Scalability | Reward draw must avoid DB hot locks during campaign peaks. | Reservation and queue patterns. |
| Security | QR codes non-enumerable; admin high-risk ops require audit and approvals. | Key rotation, RBAC. |
| Privacy | Minimize geo, device data; communicate personalized tracking. | Preference Center. |
| Observability | All critical paths with correlation\_id, dashboards, alerts, runbook. | Platform Health. |
| Recoverability | DLQ, compensation tasks, reconciliation jobs for async failures. | TDS to define RPO/RTO. |

# **22｜TDS Handoff Backlog**

TDS 應在 SAD/ADR 評審後補齊 API、DB、權限、後台、風控規則、佇列、監控與測試策略。

| TDS Area | Must Define |
| :---- | :---- |
| API Contracts | Auth, idempotency, request/response, error code, pagination, webhook endpoints. |
| Database Design | Tables, indexes, constraints, partitioning, migration scripts, retention. |
| Permissions | Admin roles, maker-checker, legal/finance approval flows. |
| Queue / Worker | Topic/queue naming, retry, DLQ, worker idempotency, backoff. |
| Risk Rules | Configurable scan thresholds, device/IP rules, team abuse scoring. |
| Compliance Rules | Rule schemas, formula engine, policy versioning, approval workflow. |
| Monitoring | Metric names, alert thresholds, runbook links, dashboards. |
| Testing | Unit, integration, property tests for gacha, reconciliation tests, load tests. |
| Seed Data | Sample campaigns, market policies, prize pools, QR batches, member states. |

# **23｜Architecture Review Checklist**

【RevC.1 治理註記：本清單為歷史紀錄（superseded），現行唯一有效之 TDS 治理清單為第 30 章。】本清單原供 Architecture Review 使用。Review 輸出應是 ADR 決策、TDS Guardrails 與 implementation backlog，而不是回寫 PRD。

| Review Area | Question | Status |
| :---- | :---- | :---- |
| Architecture Style | 是否接受 Modular Monolith first 並保留服務化邊界？ | □ |
| Bounded Context | 是否同意 Campaign、Wallet、Reward、QR、Notification、Compliance、IP Asset、CRM/Team 的資料所有權？ | □ |
| Event Architecture | 是否採 transactional outbox \+ at-least-once delivery \+ idempotent consumers？ | □ |
| Wallet Ledger | 是否採 append-only ledger \+ balance projection？是否足以支援 breakage 與日本 point\_source？ | □ |
| Reward Engine | 權杖保留層是否只做 reservation？DB Ledger / Inventory Fact 是否是最終真相？ | □ |
| QR Supply Chain | 是否採出貨/入倉 activation？是否有批次撤銷與印刷外洩處理？ | □ |
| Notification Broker | 是否禁止功能模組直發？Broker 是否是所有渠道唯一出口？ | □ |
| Compliance | 是否接受 rule engine \+ policy\_version \+ publish gate？ | □ |
| IP Asset | 是否需要 signed URL \+ policy engine？CDN purge 與 fallback 是否足夠？ | □ |
| Member/Team | Tier/Health/Team Score projections 是否滿足 PRD Rev D？ | □ |
| Observability | 是否有足夠事件、metrics、logs 支援 runbook？ | □ |
| Migration | 舊會員、舊點數、舊 QR、歷史訂單是否有安全遷移策略？ | □ |

# **24｜Open Issues and Risks**

以下議題不阻擋 SAD RevC.1，但需在 TDS 或 Codex Development Specification 之前明確決策。

| Issue | Impact | Owner / Next Step |
| :---- | :---- | :---- |
| Existing e-commerce platform constraints unknown | May affect identity merge, order callback, existing points migration. | Tech Lead to audit current platform. |
| Finance policy for breakage not finalized | Affects wallet ledger reports and deferred liability. | Finance to define month-close treatment. |
| Japan legal opinion pending | Affects point+cash, paid points, gacha configuration. | Legal to confirm before Phase 3 design freeze. |
| QR printing / packaging process not finalized | Affects activation, batch management, cost, operational flow. | Ops \+ Tech to define Phase 1 pilot. |
| BI vs custom dashboard decision pending | Affects delivery schedule and data modeling. | ADR-006. |
| Data retention and privacy policy pending | Affects event store, scan data, geo/device retention. | Legal \+ Security. |

# **25｜Baseline Conclusion and Next Deliverables**

SAD v1.0 RevB incorporates Senior SA architecture review decisions and hardening instructions. It remains an architecture document, not a TDS, and should hand off concrete implementation constraints to TDS.

RevB 結論：維持 Modular Monolith first 與 event-driven core；正式加固資料所有權隔離、Reward 高併發背壓與雙重等冪、Compliance/Wallet 高精度數值、防在架盜掃的 QR 雙層激活，以及 Notification Broker 強制唯一出口。

## **25.1 Next Deliverables**

* Architecture Review Meeting：以第 23 章 checklist 評審。輸出 ADR accepted/proposed 清單。  
* SAD v1.0 RevB：已依 Senior SA feedback 更新 ADR 決策與鋼鐵防線；下一步進入 TDS v1.0。  
* TDS v1.0：API、資料庫、權限、後台、風控規則、佇列、監控、測試策略。  
* Codex Development Specification：依 TDS 拆成可執行任務、測試、資料種子。

# **26｜RevB Senior SA Hardening Addendum（已併入 RevC）**

本章將 Senior SA feedback 轉化為 SAD RevB 的架構決策與 TDS 強制約束。原則是：PRD 不再新增產品功能；SAD RevB 補齊架構鋼鐵防線；TDS 負責實作細節、DDL、API、CI/CD 規則與測試。

## **26.1｜資料庫視圖與 API 隔離防線**

Modular Monolith 只能在程式碼、資料庫與查詢路徑三層都維持邊界時，才具備未來可拆分性。若 RD 在 SQL 中直接跨 Context Join 真實寫入表，未來微服務化、日本市場獨立部署或 Compliance 拆分將高度困難。

| 防線 | SAD RevB 決策 | TDS 必須落地 | 驗收方式 |
| :---- | :---- | :---- | :---- |
| Schema 隔離 | 同一 RDBMS 內以 bounded context 劃分 schema，例如 wallet.\*, reward.\*, crm.\*, campaign.\*, order\_core.\*。 | 每個 module 僅可寫入自身 schema；跨 schema 寫入禁止。 | DB migration review 必須標示 owning\_context；不合規 migration 不得合併。 |
| 跨模組讀取 | 禁止直接 Cross-Join 他模組真實寫入表。 | 高頻讀取使用 Read Model / Projection；需要即時強一致資訊時走 Domain Service API Interface。 | SQL lint / code review 檢查 from/join schema references。 |
| Projection Ownership | Read Models 由資料生產模組透過事件或投影管線建立。 | CRM 不直接讀 wallet ledger，而讀 crm.member\_wallet\_summary 或 Wallet API。 | Projection latency 與 freshness SLA 進 Dashboard。 |
| CI/CD Guardrail | 架構邊界必須可被機器檢查。 | 導入 ArchUnit / architecture test / static SQL scanner；跨 bounded context 直接表引用即 fail build。 | CI 報告列出 module dependency graph。 |

* 核心規則：Write tables are private to owning context; projections are public read contracts.  
* Domain Service API 不等於外部 HTTP API；在 Modular Monolith 內可先以 internal interface 實作，但不得穿透資料表。  
* TDS 需定義每個 schema 的 owning module、允許讀取的 projection，以及禁止直接引用的 fact / ledger tables。

## **26.2｜Reward 高併發：雙重等冪、背壓與 DLQ 防線**

RevA 已定義 Requested → DrawReserved → SettlementPending → FraudPassed → PrizeGranted 狀態機。RevB 補上尖峰流量下的 Queue backpressure、BFF \+ Worker 雙重等冪與 DLQ 限流規則，避免記憶體權杖層瞬間釋放大量 DrawReserved 後壓垮 DB。

| 風險 | 架構防線 | TDS 指令 | Fail / Degrade 行為 |
| :---- | :---- | :---- | :---- |
| 使用者重複點擊 | BFF idempotency gate。 | client\_request\_id / idempotency\_key 必須於 BFF 層短期鎖定。 | 重送回傳同一 draw 狀態，不重新抽。 |
| Worker 重試造成重複入帳 | DB unique constraint 作為最後防線。 | Draw Ledger 必須建立 unique(member\_id, campaign\_id, idempotency\_key)。 | 違反唯一鍵時讀取既有結果，不建立第二筆。 |
| Queue Depth 暴增 | Backpressure from Queue to BFF。 | Queue depth、oldest message age、worker lag 進 Platform Health。 | 超過閾值時 BFF 切換為排隊中，拉長 polling interval。 |
| DLQ 爆炸 | DLQ rate limit \+ incident owner。 | 同 campaign DLQ 超標自動暫停高價賞發放並通知 Tech Lead。 | 凍結賞池入口或降級為低頻抽獎。 |
| DB I/O 瓶頸 | Async settlement 與 admission control。 | Worker concurrency 必須可配置，避免 retry storm。 | 暫停新 draw 或只允許 reservation 查詢。 |

### **Reward Backpressure State**

Normal → Elevated Queue → Backpressure → Draw Queueing → Draw Paused → Recovery

* Elevated Queue：Queue depth 超過 warning threshold，Dashboard 顯示黃色告警。  
* Backpressure：BFF 不再盲目向 reservation layer 送壓力；前端顯示排隊動畫，polling interval 延長。  
* Draw Paused：Reward/Wallet 一致性或 DB latency 超過 critical threshold，暫停新抽獎入口；既有 DrawReserved 仍需完成 settlement 或 compensation。  
* Recovery：DLQ 清空、ledger/inventory reconciliation 通過、oldest message age 回落後，才可解除。

## **26.3｜Compliance 與 Wallet 高精度數值防線**

Compliance Rule Engine、Wallet Ledger、Reward EV 檢核與 Breakage 對帳均屬準財務計算。RevB 明確禁止 Float/Double，以避免日本総付景品 20% 閾值、點數負債與月結對帳出現浮點誤差。

| 計算領域 | 禁止 | 允許 / 必須 | TDS 驗收 |
| :---- | :---- | :---- | :---- |
| JP 金額 | Float / Double | 整數最小貨幣單位 JPY yen\_amount bigint。 | 無任何 decimal binary rounding；測試臨界值 999/1000/1001 JPY。 |
| TW 金額 | Float / Double | 若需小數，使用 Decimal(18,4) 或 integer cents equivalent。 | 財務報表與 ledger 對帳一致。 |
| 點數價值 | Float / Double | point\_amount bigint；point\_value\_policy 以 Decimal 表示換算規則。 | 點數發行、兌換、失效、breakage 全部可 reconcile。 |
| EV / probability | Float-only comparison | 使用 high precision decimal 計算 EV；comparison 使用明確 rounding policy。 | 合規閘門臨界值單元測試 100% pass。 |

* TDS 必須建立 Money / Points / Probability Value Object，禁止在業務程式碼中散落 primitive number。  
* Compliance Rule Engine 的比較結果需輸出 rule\_id、input\_value、allowed\_value、rounding\_policy、calculation\_version。  
* 所有 market compliance policy 的參數修改需雙人核准並保留 before/after 與 operator\_id。

## **26.4｜QR 雙層激活與批次動態熔斷**

RevA 已定義 QR 簽章、安全碼與出貨/入倉後 activate。RevB 補上 B2C 與 B2B 線下通路差異：只有商品產生可證明銷售/出庫事實後，QR 才可兌換資產，降低貨架盜掃與供應鏈外洩風險。

| 通路 / 狀態 | QR 狀態 | 激活事件 | 掃碼回應 |
| :---- | :---- | :---- | :---- |
| 印刷完成 | Pre-active / inactive | QR batch created \+ signed, but not redeemable。 | 顯示尚未啟用，不發點數。 |
| B2C 官網出庫 | Active | OrderCompleted / shipment\_created 對應商品序號段。 | 可掃碼入帳。 |
| B2B 上架前 | Inactive or channel-preactive | 入倉或出貨僅建立 channel visibility，不開放兌換。 | 顯示尚未銷售啟用。 |
| B2B POS 售出 | Active | Retail POS / ERP sales webhook；目標 SLA 1 分鐘內激活。 | 可掃碼入帳。 |
| Batch compromise | Revoked / review-only | invalid rate threshold or security incident。 | 導流至客服 Review Queue，不自動發點。 |

### **Dynamic Batch Revocation Rule**

若某 batch\_id 下 code\_verify\_result \== INVALID 的驗證失敗率在 5 分鐘內超過 TDS 設定閾值，系統需自動升級風控等級；若持續異常，撤銷該 batch 的 signing\_key\_version，將該 batch 後續掃碼導入 Review Queue，同時不波及其他正常批次。

* ADR-004 需裁決：B2B POS 激活是否在 Phase 1 就支援，或先以 B2C / 自營通路為 MVP。  
* TDS 需定義 QR status state machine：Generated, Printed, PreActive, Active, Suspended, Revoked, Expired。  
* 所有激活事件必須可追溯至 order\_id、shipment\_id、retail\_pos\_transaction\_id 或 channel\_batch\_event\_id。

## **26.5｜ADR Decision Gates from Senior SA Review**

| ADR | RevB Status | Official Decision | TDS / SAD Instruction | Notes |
| :---- | :---- | :---- | :---- | :---- |
| ADR-001 | Accepted | Modular Monolith first | 依 bounded context 建立 package \+ schema boundary；保留 service-ready seams。 | Phase 0-2 以交付與 ACID 一致性為優先。 |
| ADR-002 | Accepted | Append-only Ledger \+ Read Model Projections | Wallet ledger 不可覆寫；available\_balance 僅為 projection。 | 支援 breakage、月結、退貨扣回與 audit trail。 |
| ADR-003 | Decision Gate | Reservation \+ Queue \+ DB final truth; technology TBD | 補雙重等冪、queue backpressure、DLQ runbook、unique index。 | 技術選型在 TDS/ADR-003 確認。 |
| ADR-004 | Decision Gate | Dual Activation: Batch \+ Order/POS Linkage | B2C order activation; B2B POS/ERP sales webhook；batch revoke。 | MVP 范圍需 Product \+ Ops 確認。 |
| ADR-005 | Accepted | Mandatory Central Notification Broker | 所有 LINE / Email / SMS 只能經 Broker；禁止 module direct send。 | 守住 LINE 封鎖率與頻控。 |
| ADR-006 | Proposed | BI first \+ custom campaign war room optional | TDS 決定 Metabase/BI \+ custom dashboard split。 | 不阻擋核心架構。 |
| ADR-007 | Proposed | Policy-based IP Asset Access | signed URL \+ policy engine 待 TDS 決定。 | 授權到期真下架能力。 |
| ADR-008 | Accepted | Integrated Module with Domain Decoupling | Compliance 先為 core module，但 Market\_Compliance\_Policy 完全解耦。 | 2027 日本市場與多市場擴張。 |

# **27｜TDS Guardrails and Acceptance Criteria**

本章是 SAD RevB 對 TDS 的硬性輸入。TDS 可以決定技術選型與細部資料模型，但不得違反以下架構防線。

| Area | TDS Must Define | Acceptance Criteria | Blocking Severity |
| :---- | :---- | :---- | :---- |
| Module/Data Boundary | schema ownership, projection contracts, Domain Service interfaces, ArchUnit/static SQL rules | CI blocks illegal cross-context table reference. | P0 |
| Wallet Ledger | append-only ledger schema, projection rebuild, reconciliation report | available\_balance 可由 ledger 重建；人工調整須 maker-checker。 | P0 |
| Reward Draw | idempotency at BFF and Worker, unique index, queue backpressure, DLQ | 同一 idempotency key 不可能生成兩筆 PrizeGranted。 | P0 |
| Compliance Numeric | Money/Point/Probability value objects; no Float/Double | JP threshold tests pass for boundary values and rounding policies. | P0 |
| QR Activation | status machine, activation events, B2C/B2B differences, batch revoke | inactive QR cannot grant points; batch revoke isolates only compromised batch. | P0 |
| Notification Broker | single outbound interface, priority, cooldown, consent, template attribution | No module can directly call LINE/SMS/Email vendor APIs. | P0 |
| IP Asset Policy | policy evaluation, CDN cache purge, signed URL decision | Expired asset cannot be accessed from public URL/cache. | P1 |
| Incident Runbook | owner, SLA, metrics, auto-action, recovery criteria | Each circuit breaker has a runbook and dashboard tile. | P1 |
| Migration | legacy member/tier/wallet/QR transition plan | Grandfathering and legacy points reconcile before launch. | P1 |

## **27.1｜RevB Additional Architecture Review Checklist（superseded，整併入第 30 章）**

| Review Area | Must Answer | Status |
| :---- | :---- | :---- |
| Schema Isolation | Are wallet.\*, reward.\*, crm.\*, campaign.\* schemas separated and owned? | □ |
| Cross-Join Ban | Can CI detect direct DB references across bounded contexts? | □ |
| Read Model Contract | Are projection freshness and rebuild rules defined? | □ |
| BFF Idempotency | Can repeated draw requests return the same result without re-draw? | □ |
| Worker Idempotency | Does DB unique constraint prevent duplicate Draw Ledger entries? | □ |
| Queue Backpressure | Does queue depth trigger BFF queueing / draw pause? | □ |
| DLQ Runbook | Who owns DLQ explosion and what is the recovery SLA? | □ |
| High Precision Money | Are Float/Double banned for money, points, EV and compliance? | □ |
| JP Boundary Tests | Are JP general premium thresholds tested at ¥999/¥1000/¥1001? | □ |
| B2C QR Activation | Does OrderCompleted / shipment event activate only assigned QR range? | □ |
| B2B POS Activation | Is POS/ERP webhook required or deferred with explicit risk acceptance? | □ |
| Batch Revocation | Can compromised batch\_id be revoked without affecting other batches? | □ |

# **28｜RevC Blocking Clarifications and Architecture Hardening**

**本章將 Senior SA blocking feedback 正式收斂為 SAD v1.0 RevC 的架構要求。**

原則：PRD 不再新增產品功能；SAD RevC 僅補齊會影響公平性、帳本正確性、事件一致性、模組邊界與 TDS 可執行性的架構防線。

## **28.1｜Blocking B1：Draw Randomness Timing and Fairness Boundary**

裁決：抽獎結果必須在 DrawReserved 時刻決定。Random outcome 由 Reward Engine 在完成 idempotency check、鎖定 probability\_version\_id / inventory\_snapshot\_id、完成 prize token reservation 的同一邏輯步驟內決定；Worker settlement 僅執行已決定結果，不得重新擲骰或改判。

**RevC.1 原子性裁決（P1-1）：「判定結果」與「保留權杖」必須為單一原子操作。標準模型為「權杖即結果」（token-embodies-outcome）：賞品池以預洗牌權杖實作，每枚權杖內嵌賞級，原子取出權杖同時完成判定與保留，兩者不存在時間差。若實作採判定與保留分離之設計，則判定結果在權杖保留成功前不得對用戶可見；判定成功但保留失敗時，該次請求以 ReservationFailed 終結且不得留下任何用戶可感知的中獎痕跡。**

| User Draw Request \-\> Idempotency Check \-\> Lock probability\_version\_id \+ inventory\_snapshot\_id \-\> Determine draw\_result at DrawReserved time \-\> Reserve prize token / point grant intent \-\> Persist DrawReserved \+ Outbox Event \-\> Worker Settlement executes result without re-randomization \-\> FraudPassed / PrizeGranted / PointGranted |
| :---- |

| Invariant | Architecture Requirement | Why it matters |
| :---- | :---- | :---- |
| Probability snapshot | DrawReserved 必須寫入 probability\_version\_id、inventory\_snapshot\_id 與 public\_disclosure\_version。 | 用戶掃碼/抽獎當下看到的公示機率，必須等於實際判定機率。 |
| No re-judge in settlement | Worker 不可重新計算機率或根據當時庫存重新擲骰。 | 避免排隊期間庫存變動造成消費爭議。 |
| Auditability | DrawReserved 後即可追溯 draw\_result、risk\_status 與 token\_id\_hash。 | 客服、法務與稽核可還原單筆抽獎。 |
| Japan readiness | 一般懸賞與総付景品規則可對應到實際判定版本。 | 降低日本 oripa / 景表法環境下的公平性爭議。 |

## **28.2｜Blocking B2：Token Leakage Window, TTL and Sweep Job**

權杖保留層不得形成幽靈鎖定。任何在記憶體權杖層被扣減但未能在 DB Draw Ledger / Outbox 成功持久化的 reservation，必須在短 TTL 後自動釋放；Campaign 作戰期間需以分鐘級 sweep job 對帳權杖層、Outbox 與 Draw Ledger。（RevC.1：TTL 與 sweep 僅適用於「未持久化」之保留；已持久化且處於 FraudReview / SettlementPending 之保留由 settlement window 治理，sweep 不得釋放。）

| Control | SAD RevC Requirement | NFR / Acceptance |
| :---- | :---- | :---- |
| Reservation TTL | 每筆 DrawReserved token 必須帶 TTL；TTL 由 campaign\_risk\_level 設定，Last One / 高價賞期間採更短 TTL。 | TTL 必須遠小於檔期時間尺度；建議初始 90-180 秒，TDS 可依壓測調整。 |
| Persist-before-finalization | 記憶體 reservation 成功後，必須盡快寫入 DrawReserved \+ Outbox；未成功持久化不得前台宣告 PrizeGranted。 | 前台可顯示「獎項確認中」，不可讓用戶重抽。 |
| Sweep job | 作戰期間每 1 分鐘 sweep；非作戰期間可放寬至 5 分鐘。 | Last One 倒數期間，幽靈鎖定不得造成假性完售超過一個 sweep interval。 |
| Reconciliation owner | Reward Worker owns sweep; Platform Health Dashboard 顯示 ghost\_reservation\_count。 | 超過門檻自動告警並凍結高價賞入口。 |

## **28.3｜Blocking B3：Wallet Point Lot, FIFO Expiry and Migration**

裁決：Wallet 不只需要 append-only ledger，也需要 point lot（批次/帳齡）模型。每筆點數入帳形成帶來源、到期日與市場屬性的 lot；扣抵依 FIFO 或市場設定順序消耗；到期與提醒依 lot 產生。

| Entity / Projection | Owner | Requirement |
| :---- | :---- | :---- |
| wallet.point\_lot | Wallet Context | 每筆 point credit 產生 lot\_id、member\_id、point\_source、market\_id、grant\_event\_id、original\_points、remaining\_points、grant\_at、expires\_at、status。 |
| wallet.ledger\_entry | Wallet Context | 任何 credit、debit、expiry、reversal、adjustment 都 append-only，並引用 lot\_id 或 affected\_lot\_ids。 |
| available\_balance | Wallet Read Model | 兌換路徑需強一致讀取：以 active lots 聚合或交易內 projection 鎖定，不可讀過期快照。 |
| expiring\_soon | CRM / Wallet Projection | 可最終一致；用於提醒與 Dashboard，不可作為兌換授權依據。 |
| migration\_point\_lot | Migration Context | 舊點數遷移不得只建立 opening balance；必須盡可能保留或重建既有到期結構。 |

| Point grant \-\> Create PointLot(expires\_at) \+ LedgerEntry(CREDIT)Redeem \-\> Select lots by FIFO \-\> LedgerEntry(DEBIT with lot allocations) \-\> Update lot.remaining\_pointsExpiry job \-\> Select lots where expires\_at \<= now \-\> LedgerEntry(EXPIRE) \-\> lot.status=EXPIREDReturn/Chargeback \-\> LedgerEntry(REVERSAL) \-\> Freeze / Negative Ledger if already consumed |
| :---- |

Migration rule：若舊系統可取得點數批次與到期日，必須逐 lot 匯入；若僅有餘額，需由 Finance / Product 批准 migration\_expiry\_policy，並在會員前台揭露過渡期到期規則。

## **28.4｜Blocking B4：Pity Counter Transaction Boundary**

Pity counter 屬 Reward Context，由 Draw Ledger 同交易範圍管理。每次 DrawReserved 都必須記錄 pity\_before、pity\_after、pity\_rule\_version；重放或補償任務必須透過 draw\_id / idempotency\_key 保證 pity 不重複累加。

| Rule | Requirement | Failure mode prevented |
| :---- | :---- | :---- |
| Ownership | per-member × per-pool pity counter belongs to Reward Context. | 避免 CRM / Wallet / Campaign 各自維護導致狀態分裂。 |
| Transaction boundary | DrawReserved、draw\_result、pity update、outbox event 必須在同一 DB transaction 或同等一致性邊界內完成。 | 避免抽獎成功但保底未更新，或補償重放造成保底雙增。 |
| Replay safety | Settlement Worker 重放時讀取 Draw Ledger 既有 pity\_after，不重新累加。 | 避免 retry loop 使會員提前觸發保底。 |
| Audit | Draw Audit Log 必須包含 pity\_rule\_version、pity\_before、pity\_after。 | 客服可解釋會員為何觸發或未觸發保底。 |

## **28.5｜Blocking B5：Event Ordering Guarantee**

裁決：所有會影響金流、Wallet、Reward、Order、Team 與 Tier 的事件流，採 per-aggregate partitioned ordering；consumer 仍必須 idempotent，並以 aggregate\_version / event\_sequence 做版本檢查。

| Event Family | Partition Key | Ordering Requirement |
| :---- | :---- | :---- |
| Order events | order\_id | OrderCreated → PaymentCaptured → OrderCompleted → ReturnCompleted / ChargebackConfirmed 必須保序。 |
| Wallet events | wallet\_id / member\_id | PointGranted → PointDebited → PointExpired / Reversed 必須保序；跨 wallet 不需全域順序。 |
| Reward draw events | draw\_id / campaign\_id \+ member\_id | DrawReserved → SettlementPending → FraudPassed → PrizeGranted 必須保序。 |
| Team events | team\_id | ContributionPending → Confirmed/Frozen/Reversed → TeamRankUpdated 必須保序。 |
| Notification events | member\_id | 同會員 outbound messages 需保序進 Broker 以正確套用 cooldown。 |

| Consumer invariant:1\. Reject stale event if event.aggregate\_version \<= current\_version.2\. Buffer or retry future event if event.aggregate\_version \> current\_version \+ 1\.3\. Every mutation must be idempotent by event\_id and business\_idempotency\_key.4\. Reversal events must reference original\_event\_id / original\_order\_id. |
| :---- |

## **28.6｜Major M1：Read Model Consistency Classification**

| Read Model | Consistency Level | Allowed Usage |
| :---- | :---- | :---- |
| available\_balance | Strongly consistent on redemption path | 兌換、點加金、抽獎券消耗、退款扣回。必須交易內讀取 active lots / ledger projection。 |
| member\_tier\_checkout（RevC.1 拆分） | Strongly consistent（無 or） | Checkout 折扣與權益判定影響金額，必須交易內強一致讀取正式級距。前台顯示另立 member\_tier\_display 讀模型，允許 bounded-stale，不得用於計價。 |
| expiring\_soon\_points | Eventually consistent | LINE 到期提醒、會員中心提示；不得作為實際可兌換授權。 |
| team\_rank\_display | Eventually consistent \+ label | 前台可顯示預估排行；正式排行只用 Confirmed Points 批次結算。 |
| dashboard\_metrics | Eventually consistent | 經營分析與告警；需顯示 data\_latency。 |
| risk\_status\_for\_high\_value\_reward | Strong or near-real-time | 高價賞 DrawReserved → FraudPassed 前需讀 current risk status。 |

## **28.7｜Major M2：PendingGrant for Anonymous / Unregistered QR Scan**

未註冊者掃碼不能直接消耗一次性 QR 後遺失獎勵，也不能無限期保留未歸屬資產。SAD RevC 新增 PendingGrant 實體作為掃碼轉會員漏斗的核心結構。

| State | Meaning | Transition |
| :---- | :---- | :---- |
| Created | 有效 QR 被未登入/未註冊使用者掃描，碼已核銷但獎勵尚未入帳。 | Create PendingGrant with qr\_code\_id, campaign\_id, reward\_intent, expires\_at。 |
| Claimed | 使用者完成註冊/登入與手機或 LINE 綁定後入帳。 | PendingGrant \-\> Wallet Credit / Collection Unlock / DrawReserved。 |
| Expired | 註冊期限內未完成綁定。 | 獎勵作廢或依政策釋回；QR 是否可重掃由 campaign policy 決定。 |
| FraudReview | 掃碼或裝置命中高風險。 | 暫不入帳，轉 Review Queue。 |

| Anonymous QR flow:Scan valid QR \-\> Verify code \-\> Mark QR reserved-by-pending（RevC.1 預設；碼於綁定完成前不真正核銷，Expired 時釋回可重掃）；consume-at-scan 僅限 campaign policy 明示採用 \-\> Create PendingGrant \-\> Registration funnel \-\> Bind member \-\> Grant reward \-\> Close PendingGrant |
| :---- |

## **28.8｜Major M3：Modular Monolith Boundary Enforcement**

在共享 RDBMS 的模組化單體中，邊界不是口號，必須落到 schema、read contract 與 CI fitness function。RevC 將邊界規則正式拆成寫隔離與讀契約。

| Boundary Rule | Decision | Enforcement |
| :---- | :---- | :---- |
| Write isolation | 絕對禁止跨 bounded context 寫入 source-of-truth table。 | DB role grants、repository package ownership、code review required。 |
| Read contract | 跨界高頻讀取走 projection/read model；強一致讀取走 domain service API。 | 禁止 ad-hoc cross-schema join 進入 production code。 |
| Schema isolation | 同一 RDBMS 內採 wallet.\*, reward.\*, crm.\*, campaign.\*, notification.\* 等 schema。 | Migration scripts 必須標示 owning context。 |
| CI fitness function | TDS 導入 import lint、ArchUnit 或同等 architecture tests；靜態 SQL 掃描違規 schema 引用。 | 違規 build fail。 |
| Exception process | 任何跨 schema direct read exception 需 ADR 或 Tech Lead temporary waiver。 | waiver 有期限與替代 projection backlog。 |

## **28.9｜Major M4：Capacity Model and Peak Sizing Inputs**

ADR-003 的技術選型不得空對空。Product 需在 TDS 前提供 campaign peak assumptions；SAD RevC 定義容量模型欄位與初始估算方法。

| Sizing Input | Definition | Owner |
| :---- | :---- | :---- |
| campaign\_units\_sold\_day1 | 檔期首日預估出貨或售出盒數。 | Product / Sales |
| scan\_activation\_rate\_24h | 首 24 小時掃碼率。 | Product / Data |
| peak\_concentration\_window | 尖峰集中時間窗，例如開賣後 10 分鐘或 Last One 倒數 5 分鐘。 | Product / Ops |
| draws\_per\_scan | 每次掃碼平均觸發抽獎/點數/圖鑑事件數。 | Product |
| retry\_multiplier | 因 timeout / client retry 造成的請求放大係數。 | Tech Lead |
| target\_qps | 估算公式：units × scan\_rate × draws\_per\_scan × retry\_multiplier / window\_seconds。 | Architect |

| Example formula:Peak Draw QPS \= campaign\_units\_sold\_day1 \* scan\_activation\_rate\_24h \* draws\_per\_scan \* retry\_multiplier / peak\_window\_secondsTDS must size: BFF rate limit, reservation layer ops/sec, queue throughput, worker concurrency, DB write IOPS, dashboard event latency. |
| :---- |

## **28.10｜Major M5：Idempotency Store Ownership**

雙重等冪是必要的，但 ownership 必須清楚。SAD RevC 定義 request-level idempotency 與 business-level idempotency 分層。

| Layer | Owner | Scope / TTL |
| :---- | :---- | :---- |
| Request Idempotency | BFF / API Gateway | client\_request\_id 防止前端重送；TTL 依 operation risk 設定。低價掃碼可較短，高價抽獎與兌換需至少覆蓋完整 settlement window。 |
| Business Idempotency | Owning Domain Context | Reward Draw 以 member\_id \+ campaign\_id \+ idempotency\_key / draw\_id unique index 防重；Wallet 以 event\_id \+ lot allocation 防重。 |
| Worker Idempotency | Consumer / Worker | 每個 MQ event 以 event\_id、business\_key、aggregate\_version 寫入 processed\_event log 或唯一約束。 |
| Shared visibility | Platform Observability | idempotency hit rate、duplicate rejected count、retry loop count 進 Platform Health。 |

## **28.11｜Minor Hook Fixes**

| Minor Feedback | SAD RevC Fix |
| :---- | :---- |
| Tier downgrade 30-day warning | 新增 TierDowngradeWarningScheduled / TierDowngradeWarningSent events，必須經 Notification Broker Level 2 發送。 |
| GA4 / Domain event double-write reconciliation | Data Lead owns analytics reconciliation；GA4/GTM events 不可作為 source of truth，需與 internal event store 對帳。 |
| Japan data localization / APPI open issue | 加入 Open Issue：日本市場是否需資料在地化、跨境傳輸告知與 DPA，Legal \+ Security 於 Phase 3 前定案。 |

# **29｜ADR Decision Status after RevC**

本章更新 Architecture Review 後的 ADR 狀態。Accepted 代表 SAD 方向已確定；TDS 仍需補具體產品選型、DDL、API 與測試。

| ADR | Status after RevC | Decision / Guardrail |
| :---- | :---- | :---- |
| ADR-001 Modular Monolith vs Microservices | Accepted | Modular Monolith first with service-ready boundaries；schema by bounded context；future extraction via ADR。 |
| ADR-002 Wallet Ledger Event Sourcing Level | Accepted | Append-only Ledger \+ PointLot \+ Read Model Projections；available\_balance 兌換路徑強一致。 |
| ADR-003 Reward Draw Transaction Boundary | Accepted as constraints, technology TBD | Randomness at DrawReserved；reservation TTL \+ sweep；BFF \+ Worker idempotency；backpressure；DB ledger final truth。 |
| ADR-004 QR Activation Boundary | Accepted as decision gate, integration TBD | B2C order/shipment activation；B2B POS/ERP sales webhook activation；batch revoke and review queue。 |
| ADR-005 Notification Broker as only outbound channel | Accepted | 所有 LINE / Email / SMS 必須經 Broker；功能模組禁止直發。 |
| ADR-006 Dashboard BI vs Build | Open | TDS 比較現成 BI / 自建作戰室；Platform Health 需支援 event latency 和 queue depth。 |
| ADR-007 IP Asset signed URL \+ policy engine | Open | 素材下架、CDN purge、OG fallback、低解析瀏覽由 TDS 定義。 |
| ADR-008 Compliance Rule Engine Boundary | Accepted | Integrated module with domain decoupling；MarketCompliancePolicy 獨立配置；禁用 Float/Double。 |
| ADR-009 Event Ordering Guarantee | Accepted | Critical streams partition by aggregate\_id \+ versioned consumer；reversal references original event。 |
| ADR-010 Boundary Enforcement Fitness Functions | Accepted | CI 導入 architecture tests、schema reference scanner、import lint，阻擋違規跨 context 依賴。 |

# **30｜TDS Guardrails Checklist｜RevC**

下列項目為 TDS v1.0 RevA 的必填 guardrails，不應回流 PRD；若 TDS 未回答，則不得進入 Codex Development Specification。（RevC.1：本章為全文件唯一有效之治理清單，第 23、27.1 章清單均已 superseded。）

| Category | TDS Must Specify | Blocking Level |
| :---- | :---- | :---- |
| Draw Randomness | DrawReserved-time randomization algorithm, probability snapshot write path, no re-randomization in worker. | Blocking |
| Reservation TTL | TTL values, sweep interval, ghost reservation metrics, Last One high-risk mode. | Blocking |
| Point Lot | DDL for point\_lot, ledger\_entry lot allocation, FIFO debit, expiry job, migration policy. | Blocking |
| Pity Counter | pity counter table/fields, same transaction boundary with DrawReserved, replay-safe semantics. | Blocking |
| Event Ordering | Queue topic/partition key, aggregate\_version checks, stale/future event handling. | Blocking |
| Read Consistency | Strong vs eventual read model list, query path, lock strategy for redemption. | Major |
| PendingGrant | PendingGrant lifecycle, expiry policy, anonymous scan registration funnel, fraud review. | Major |
| Boundary Enforcement | DB schema grants, repository layout, architecture tests, static SQL scanner. | Major |
| Capacity Model | Peak QPS inputs, sizing assumptions, worker concurrency, queue depth alarms, backpressure thresholds. | Major |
| Idempotency Store | BFF store, domain store, worker store, TTL, unique indexes, replay tests. | Major |
| Money Precision | Value objects, integer minor units / Decimal, JP threshold tests at ¥999/¥1000/¥1001. | Major |
| QR Activation | B2C/B2B activation webhooks, batch revoke, signing\_key\_version rotation, INVALID rate threshold. | Major |
| Analytics Reconciliation | Internal event store vs GA4 event mapping, reconciliation owner and daily report. | Minor |
| Japan Open Issues | APPI cross-border transfer, data residency, DPA, retention-by-market. | Minor |
| Lot Reversal Semantics (RevC.1) | 退貨/沖正之點數回補歸屬：未過期者回補原 lot（保留原到期日），已過期者轉補償路徑；不得以新 lot 重置帳齡造成到期結構漂移。 | Major |
| FraudReview Hold Exemption (RevC.1) | Sweep/TTL 僅釋放未持久化保留；FraudReview / SettlementPending 之已持久化保留由 settlement window 治理，明列 sweep 排除條件與逾時升級路徑。 | Major |
| Future-event Buffer Bound (RevC.1) | Consumer 對 aggregate\_version 超前事件之 buffer 必須有容量上限與逾時；超限/逾時轉 DLQ 並告警，不得無界成長。 | Major |
| B2B Activation Scope Gate (RevC.1) | Phase 1 僅實作 B2C 激活與抽象 activation 事件介面；B2B POS/ERP webhook 路徑不得於 Phase 1 開發，啟動需 Product \+ Ops 依 ADR-004 決策門核准。 | Major |

# **31｜RevC Conclusion**

SAD v1.0 RevC resolves the five blocking gaps raised by Senior SA review. The architecture is now sufficiently precise to enter TDS v1.0 RevA. Further detail must be expressed as technical design: API contracts, DDL, indexes, queue topics, worker retry policy, CI guardrails and test cases. PRD remains frozen; SAD RevC.1 (errata applied) is the approved architecture baseline for TDS. RevC.1 errata: P1-1 token-embodies-outcome atomicity, P1-2 member\_tier read model split, four P2 guardrail rows, PendingGrant default, and checklist governance consolidation (Chapter 30 is the sole governing list).