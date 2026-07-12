**5min coffee**

**平台 2.0 改版總體規格書**

*Product Requirement Document (PRD)*｜*Version 1.1 Final Rev D (Frozen for Architecture Review)*｜*System Architect Review*

**項目**  
**內容**  
文件版本  
v1.1 Final Rev D（Frozen for Architecture Review）  
文件日期  
2026 年 7 月  
Owner  
5min coffee / Best Moment Inc.  
主要讀者  
CEO、PM、System Architect、Tech Lead、UI/UX Lead、財務、法務、Codex / AI Coding Agent  
審查目的  
確認產品目標、平台能力、模組邊界、財務與合規防線、系統整合點與下一階段架構設計範圍

**Revision History**

**版本**  
**變更摘要**  
**狀態**  
v1.0  
1.0 現況分析、2.0 改版、CRM 分層、KPI 儀表板、整合時程與風險  
母版  
v1.1  
新增 Product Vision、Platform Flywheel、Platform Capability、Domain Model、System Context、Customer Health Score、Platform KPI、Architecture Review Checklist  
Final  
v1.1 Rev A  
依審查回饋補齊雙軌財務防線、QR 風控欄位、一番賞庫存/機率同步、IP 素材生命週期、LINE 即時/批次邏輯、戰隊風控與告警熔斷  
已併入  
v1.1 Rev B  
補齊四項殘餘缺口：① 日本資金決済法（點加金模式）合規防線；② QR 碼生成端密碼學安全；③ 賞池發布時之景品表示法 EV 上限機器檢核；④ 掃碼 Breakage 認列政策。另釐清市場範圍  
已併入  
v1.1 Rev C  
鋼盾層：① Reward Engine 高併發權杖保留與抽獎公平稽核；② Team Score Vesting / Clawback；③ Notification Broker 全域頻控；④ Compliance Rule Engine（含総付景品規則修正）；⑤ Incident Runbook / ADR；⑥ Member Tier × Retention Grade × Team Synergy  
已併入  
v1.1 Rev D  
收斂版（Frozen for Architecture Review）：① 折扣級距整併入 Contribution Tier 並定義遷移與既有權益保障；② Health Score 與 Retention Grade 統一為單一評分公式；③ Tier 制度分階段啟用（上線三級、Phase 3 展開六級），權重全數參數化；④ 2.10 實作名詞抽象化，選型下放 ADR  
本版

**Approval Matrix｜簽核矩陣**

本 PRD 凍結為 v1.1 Final Rev D（Frozen for Architecture Review）。下列角色須於 Architecture Review 前完成確認並簽署；任一角色提出 Blocking Issue 時，解凍需經 CEO / Business Owner 與 Product Owner 雙簽核准，並以 Rev E 起版。

**Role**  
**Reviewer**  
**必須確認範圍**  
**簽署 / 日期**  
CEO / Business Owner  
Benjamin / 5min Coffee  
商業方向、會員制度（Tier 整併與遷移）、階段 Roadmap  
\_\_\_\_\_\_\_\_\_\_\_\_  
Product Owner  
PM  
Scope、User Journey、功能優先級、Out of Scope 邊界  
\_\_\_\_\_\_\_\_\_\_\_\_  
System Architect  
Architect  
模組邊界、Platform Capability、ADR Candidate、SAD 範圍  
\_\_\_\_\_\_\_\_\_\_\_\_  
Tech Lead  
Engineering  
可開發性、風險、技術約束、Phase 1 驗收條件（碼簽章、EV 閘門）  
\_\_\_\_\_\_\_\_\_\_\_\_  
Finance  
Finance  
Wallet 帳本、breakage 認列、bridge\_weight 折扣成本、戰隊獎勵 ROI  
\_\_\_\_\_\_\_\_\_\_\_\_  
Legal  
Legal  
日本法遵（資金決済法→景表法総付/懸賞→APPI）、台灣消保、IP 授權、個資  
\_\_\_\_\_\_\_\_\_\_\_\_  
CRM Owner  
CRM / Marketing  
LINE OA、六層分層、Notification Broker 頻控、劇本矩陣  
\_\_\_\_\_\_\_\_\_\_\_\_

**簽核規則**

	•	各角色確認範圍以本表為準；範圍外意見列為 SAD 階段輸入，不阻擋凍結。

	•	Legal 與 Finance 對日本市場相關章節（4.6、5.1）之確認，為 Phase 3 啟動的前置條件，可後置於 Phase 1 開發之後、但不得晚於日本市場設計凍結。

	•	簽核完成後，本文件僅接受勘誤級修改（錯字、格式）；任何規格變更一律進入 SAD/ADR 流程或起版 Rev E。

**Executive Summary**

**5min coffee 2.0 的核心不是單純網站改版，而是把 1.0 已存在但彼此孤立的資產（掃碼點數、隨機贈品、兌換盲盒、跟團碼、階梯折扣）轉化為可重複、可配置、可量測的平台能力。**

**決策項**  
**定義**  
Product Vision  
建立亞洲第一個以 ACG IP 為入口、以咖啡為日常、以會員與收藏為核心的 Coffee Membership Platform。  
Business Goal  
聯名線負責獲客與話題，自有品牌線負責日常留存；透過 QR、Collection、Mission、CRM 將兩軌串成會員生命週期。  
North Star KPI  
Monthly Active Coffee Members (MACM)：每月有購買、掃碼、任務、收藏、兌換、LINE 互動任一活躍事件的會員數。  
Primary Success Metrics  
90 天二購率、QR Scan Rate、IP→自有品牌跨軌轉換率、Repeat+VIP 占比、LTV:CAC、LINE 封鎖率。  
Scope  
聚焦產品、商業與架構審查；不展開 API、Database Schema、C4 Component、部署與程式碼任務。市場範圍為台灣（現行）與日本（H2 2027）；新加坡不在本版 Scope（Rev B 釐清）。

**核心判斷**

	•	咖啡本身就是抽獎券：掃碼驗證的是開封與飲用，而不是單純購買。

	•	聯名不是短期活動，而是可配置 Campaign；每一檔 IP 應在相同引擎上運作。

	•	點數、任務、圖鑑與 LINE OA 不是獨立功能，而是會員生命週期的事件鏈。

	•	PRD 之後應拆出 SAD 與 TDS，避免把產品需求與工程設計混在同一份文件。

**Rev A 補強重點（已併入）**

	•	雙軌橋接從概念改為可控財務規則：聯名計入權重、級距上限、退貨扣回、點數凍結。

	•	掃碼與開獎從體驗描述改為可稽核事件：風控門檻、Webhook 欄位、裝置與地理訊號。

	•	CRM 從每日批次升級為事件優先：即時互動讀取現時狀態，分層/LTV 仍由夜間批次校正。

	•	Dashboard 告警升級為熔斷機制：封鎖率或獎池異常時自動暫停低優先劇本/賞池。

**Rev B 補強重點（已併入）**

	**•	① 日本資金決済法防線：**「點加金」模式在日本可能構成前払式支払手段，觸發登記義務與未使用餘額 50% 供託；列日本法遵清單第一位，須早於景品表示法定案。

	**•	② 碼生成端安全：**QR 碼值須以密碼學簽章生成（不可預測、不可枚舉），與行為側風控構成兩道獨立防線；列 Phase 1 上線驗收條件。

	**•	③ EV 上限機器檢核：**賞池發布閘門內嵌各市場給獎價值上限自動驗算（日本：景表法單獎 20 倍／10 萬日圓、總額 2%），超限配置無法發布，取代人工檢查。

	**•	④ Breakage 認列政策：**永不被掃的碼（預估 20-30%）對應之未實現點數屬遞延負債，認列政策與客服補發流程於 Phase 1 前與財會定案。

**Rev C 鋼盾層（已併入）**

	•	Reward Engine 高併發權杖保留＋抽獎公平稽核（機率版本快照、Draw Audit Log、Admin 不得指定中獎）。

	•	Team Score Vesting（Pending/Confirmed/Frozen/Reversed）＋ N+14 延遲結算＋ Clawback。

	•	Notification Broker：所有推播經中央閘門，優先權三級、24 小時冷卻、全域頻控、Buffer Queue 過期即棄。

	•	Compliance Rule Engine：法規公式鎖擴充総付景品規則（交易額 \<¥1,000 → 景品上限 ¥200；≥¥1,000 → 20%）——掃碼必得點數屬総付景品而非一般懸賞，此為對 Rev B EV 閘門的法條修正。

	•	Incident Runbook（每個熔斷有 Owner／SLA／解除條件）＋ 8 項 ADR Candidate 移交 SAD。

	•	Member Tier × Retention Grade × Team Synergy 三軸會員治理。

**Rev D 收斂重點（本版，Frozen）**

	**•	① 級距整併與遷移：**折扣級距不再是獨立系統，整併為 Contribution Tier 的權益輸出；定義既有會員遷移映射與 365 天既得權益保障（grandfathering），消除「第四條階梯」的認知負擔回歸風險。

	**•	② 單一評分公式：**廢除 Health Score 與 Retention Grade 雙公式並存；統一為單一 Health Score 公式，Retention Grade 定義為其字母等級視圖（A/B/C/D/X）。

	**•	③ Tier 分階段啟用：**上線期（Phase 1-2）僅啟用三級簡化版（Bean／Roaster／Legend），完整六級與戰隊倍率制於 Phase 3 展開；所有權重與倍率存設定表，以兩季實際數據回測後校準。

	**•	④ 實作紀律：**2.10 之快取／佇列產品名稱抽象化為能力描述，具體選型回歸 ADR-003，維持 PRD 不含實作決策的原則。

**Platform Thesis**

IP Topic → QR Scan → Prize/Point → Collection → Member Habit → Coffee Refill → Referral/Team → Next IP

**1｜Product Vision 與 Platform Principles**

2.0 版本必須從『聯名商品商城』升級為『ACG Coffee Membership Platform』。平台的價值不只來自每檔 IP 的銷售，而是每檔 IP 都能持續增加會員、資料、收藏、任務與日常咖啡消費。

**平台原則**  
**說明**  
**對系統設計的影響**  
Everything is a Campaign  
每一檔 IP、每個賞品池、每波促銷與任務都視為 Campaign。  
活動不寫死，透過 Campaign Engine 配置。  
Everything is Configurable  
機率、保底、點數、任務、推播、兌換限制都應可後台設定。  
降低每檔 IP 上線的工程依賴。  
Everything Generates Events  
訂單、掃碼、開獎、兌換、圖鑑、任務、推播均生成事件。  
CRM 與 Dashboard 以事件驅動。  
Everything is Measurable  
所有關鍵行為都需被追蹤，並對應 KPI 與告警。  
GA4 / Pixel / DB Events / LINE Events 需一致命名。  
Everything is Reusable  
QR、Reward、Collection、Mission 不依單一 IP 重寫。  
平台能力抽象化，支援多 IP、多市場。  
Compliance is Enforced by Code（Rev B 新增）  
跨市場合規限制以機器檢核強制，而非依賴人工審查記憶。  
賞池發布閘門、素材授權到期、給獎 EV 上限均由系統驗算與阻擋。

**產品不做事項（Out of Scope）**

	•	不在本文件定義最終 UI 視覺稿、完整 API 文件、資料庫欄位、雲端部署與工程任務拆解。

	•	不在 PRD 中決定是否微服務化；此議題應於 SAD / ADR 決策。

	•	法律合規之『細部條文解釋』由法務出具意見；但合規『系統防線』（發布閘門、EV 檢核、供託影響評估）屬本 PRD 範圍（Rev B 釐清）。

	•	新加坡市場不在本版 Scope；未來納入時依 Market\_ID 架構增掛市場參數即可（Rev B 釐清）。

**Part 1｜1.0 現況網站分析摘要**

**v1.0 對現況的核心判斷維持不變：5min coffee 以『聯名線獲客、自有品牌線留存』雙軌模式運作。2.0 的關鍵不是新增更多功能，而是補上雙軌之間的轉換橋樑。**

**構面**  
**1.0 現況優勢**  
**1.0 限制**  
**2.0 要解決的問題**  
商業模式  
IP 聯名快速獲客；自有品牌提供日常咖啡現金流。  
兩軌彼此割裂。  
建立 IP→自有品牌、自有品牌→IP 的跨軌橋接。  
資訊架構  
IP 優先陳列，短期轉換快。  
年增 30-80 SKU 後扁平選單失控。  
本期聯名、常態商城、歷代典藏館三層架構。  
會員  
階梯折扣、點數、跟團碼已存在。  
入口分散，無整合儀表板。  
會員中心成為點數、圖鑑、任務、折扣、跟團碼總控台。  
技術  
圖床分離、GTM / Pixel 既有基礎。  
jsessionid 影響 SEO 與分享。  
移除 jsessionid，事件追蹤標準化。

**現況重點：三層 Random Mechanism**

	•	第一層：掃碼隨機點數。把實體開封/飲用轉換成數位帳戶資產。

	•	第二層：購買層隨機贈品。禮盒隨附隨機周邊，屬於消費即抽。

	•	第三層：點數兌換層盲盒。以點數兌換盲袋/盲盒，已有兌換結構。

	•	2.0 要把三層收斂成『掃碼→開獎→收藏→再買』的完整體驗鏈。

**1.1｜雙軌帳本橋接與財務防線｜Rev A＋Rev B**

**核心原則：聯名消費可以啟動留存階梯，但不得讓低毛利聯名 SKU 直接吃掉自有品牌的高階折扣毛利。**

**橋接規則**  
**產品規則**  
**財務/風控邊界**  
橋接 A：聯名→自有品牌  
聯名商品消費金額可依 SKU 毛利設定 20% / 30% / 50% 計入 365 天累積；預設非 1:1。  
聯名消費最高只能啟動首階 9 折；8 折/75 折/7 折需由自有品牌咖啡實際消費達成。  
橋接 B：自有品牌→聯名  
自有品牌商品滿額贈當期抽獎券或點數；抽獎券可配置到指定 IP 賞池。  
滿額門檻須以毛利回測設定；抽獎券有效期與賞池期間綁定，不得跨未授權 IP。  
退貨扣回  
聯名或自有品牌退貨完成時，系統重算 365 天累積、折扣級距、點數、抽獎券與戰隊貢獻。  
若點數/券已使用，先凍結可用點數；不足部分建立 negative ledger，不允許兌換高價賞品。  
毛利鎖定  
每個 SKU 增加 gross\_margin\_band 與 bridge\_weight 欄位，由營運/財務設定。  
若 SKU 毛利低於最低門檻，bridge\_weight=0；折扣與點數回饋不可疊加。  
審計紀錄  
所有點數、抽獎券、級距、戰隊積分變動都寫入不可覆寫 Ledger。  
任何人工調整必須記錄 operator\_id、reason\_code、before/after、timestamp。  
Breakage 認列（Rev B 新增）  
已出貨但未被掃描的碼對應之潛在點數，以歷史掃碼激活率估算 breakage（預估 20-30% 恆不被掃）。  
未實現點數屬遞延負債性質；認列政策（逐期攤銷或碼效期屆滿認列）於 Phase 1 前與財會定案。印刷不良碼建立客服補發流程與印刷良率驗收標準。

**Refund / Chargeback Logic**

ReturnCompleted

  → RecalculateEligibleSpend(365d)

  → ReverseBridgeCredit / FreezeVoucher / ReversePoints

  → RecalculateTier / TeamScore

  → Notify Member if visible benefits changed

**Acceptance Criteria**

	•	任一退貨事件需在 5 分鐘內完成點數、抽獎券、折扣級距與戰隊積分的回算或凍結。

	•	會員前台需顯示『暫凍點數/券』與原因，避免客服爭議。

	•	後台可用歷史訂單回測不同 bridge\_weight 對毛利與升級率的影響。

	•	財務月結報表需呈現：已發行點數、已兌換、已到期失效、breakage 估計與遞延負債餘額（Rev B 新增）。

**1.7｜Platform Flywheel**

2.0 的成長不應只看單次檔期 GMV，而應觀察每檔 IP 是否能讓平台飛輪轉得更快。飛輪的關鍵是將流量、消費、掃碼、收藏與會員資料串成可累積資產。

Top-tier ACG IP → QR Scan / 開獎 → Collection 圖鑑 → Membership / CRM

  → Daily Coffee Repeat → Referral / Team → ↺ 下一檔 IP 檔期

**飛輪節點**  
**核心事件**  
**主要 KPI**  
IP  
CampaignViewed / ProductViewed  
新客數、首週 GMV、CAC  
Scan  
QRCodeScanned / PointGranted  
掃碼率、首掃時間、重複掃碼異常率  
Collection  
CollectionUnlocked / BadgeEarned  
圖鑑解鎖率、完冊率、分享率  
Membership  
LineBound / TierUpdated  
LINE 綁定率、Repeat+VIP 占比  
Coffee Repeat  
OrderCompleted / RefillTriggered  
二購率、回購間隔、AOV  
Referral  
TeamJoined / ReferralUsed  
跟團碼使用率、戰隊貢獻 GMV

**Part 2｜2.0 平台改版規格**

**核心命題：把 1.0 已存在但孤立的資產串成一條完整漏斗：IP 話題獲客 → 掃碼開獎激活 → 收藏圖鑑留存 → 跨軌導入自有品牌日常複購 → 跟團裂變再獲客。**

**一級區域**  
**功能目的**  
**主要內容**  
本期聯名  
檔期銷售與話題引爆  
IP 策展頁、倒數、SKU 陣列、賞品池、任務  
常態商城  
自有品牌日常消費  
濾掛、茶包、烘焙度、咖啡推薦、訂閱/補貨  
歷代典藏館  
品牌實績與絕版資產  
已絕版 IP、過往聯名、收藏展示、SEO 長尾  
會員中心  
所有個人化資產入口  
點數、折扣、圖鑑、任務、跟團碼、通知  
點數商城  
兌換與盲盒場景  
點數兌換、點加金（市場別合規開關，見 5.1）、機率公示、庫存

**Page-level Success Criteria**

	•	首頁必須在 3 秒內讓使用者理解：現在是哪一檔 IP、怎麼買、掃碼/點數有何價值。

	•	IP Landing Page 必須同時服務粉絲情緒、商品轉換與收藏機制說明。

	•	會員中心必須成為高頻入口，而不是訂單查詢的附屬頁。

**2.4｜Platform Capability Map**

2.0 從『功能清單』提升為『平台能力』。未來每一檔 IP 不應重新開發，而應透過相同 Engine 配置不同規則、素材、機率、任務與通知。

**平台能力**  
**Business Responsibility**  
**輸入**  
**輸出**  
Campaign Engine  
管理 IP 檔期生命週期  
IP、期間、素材、商品、規則  
Landing、任務、賞池、Dashboard  
QR Engine  
碼生成、一碼一用、防弊、掃碼事件  
QR 批次、簽章金鑰、會員、裝置、位置  
Scan Event、風控告警  
Reward Engine  
開獎、點數、賞品、保底、合規檢核  
機率、庫存、保底、限制、Market 合規參數  
PointGranted、PrizeUnlocked、發布阻擋  
Collection Engine  
圖鑑、徽章、完冊獎勵  
解鎖條件、素材、IP 分冊  
CollectionUpdated、BadgeEarned  
Mission Engine  
日/週/月/IP 任務  
任務條件、觸發事件  
MissionCompleted、RewardIssued  
CRM Engine  
分層、健康度、標籤  
訂單、掃碼、LINE、收藏  
SegmentUpdated、HealthScoreUpdated  
Notification Engine  
LINE/Email/SMS 觸發溝通  
事件、標籤、頻控、模板  
NotificationSent、Blocked  
Analytics Engine  
KPI、告警與作戰室  
事件流、訂單、會員、LINE  
Dashboard、Alert、Report

**Capability Relationship**

Campaign Engine

  ├─ QR Engine → Reward Engine → Wallet / Prize

  ├─ Mission Engine → Collection Engine → Badge / Share

  ├─ CRM Engine → Notification Engine → LINE OA

  └─ Analytics Engine → Dashboard / Alert

**2.5｜掃碼中台與開獎引擎：碼安全、欄位、風控｜Rev A＋Rev B**

**掃碼中台不是單純動畫體驗，而是連接實體商品、會員身份、點數帳本、風控與 Dashboard 的事件入口。防線分兩層：生成端讓碼不可枚舉（Rev B），行為端攔截異常掃碼（Rev A）。**

**生成端安全（Rev B 新增，Phase 1 上線驗收條件）**

	•	碼值不得採流水號、時間戳或任何可推導規則生成——否則攻擊者無需購買任何商品即可分散式窮舉掃空點數池，且不會觸發任何行為側頻率門檻。

	•	碼值須以密碼學方法生成：伺服器端保存之秘密金鑰對批次資訊簽章後截斷編碼（實作演算法由 SAD/TDS 決定），使碼值不可預測、不可枚舉、可離線驗證真偽。

	•	有效碼空間與已發行碼數量之比例須足夠稀疏，隨機猜測命中率低於可接受閾值（具體閾值於 TDS 定義）；驗證失敗事件全數入庫並計入風控訊號。

	•	金鑰輪替與批次撤銷機制：單一批次外洩（如印刷廠檔案外流）時可撤銷該批次而不影響其他在途商品。

**行為端風控與事件規格（Rev A）**

**項目**  
**PRD 規格**  
**異常處理**  
一碼一用  
每個 qr\_code\_id 僅可成功入帳一次；第二次掃描顯示已使用狀態。  
第二次以上掃描仍記錄事件，但不發點數/獎品，供客服與風控查詢。  
風控門檻  
同 IP 10 分鐘內 \>20 次掃碼、同 device\_id 10 分鐘內 \>10 次掃碼、同 member\_id 24 小時 \>60 次掃碼即觸發。  
中風險：圖形驗證碼；高風險：暫停入帳並進 Review Queue；重複異常暫鎖 24 小時。  
開獎 SLA  
手機端掃碼後 3 秒內顯示開獎結果；事件入庫需近即時。  
Reward 回寫失敗時顯示『處理中』，不得重抽；由 idempotency\_key 補償。  
Webhook 欄位  
需包含 scan\_timestamp、member\_id、qr\_code\_id、campaign\_id、sku\_id、device\_info、ip\_address、geo\_location、user\_agent、risk\_score。  
geo\_location 以城市/區域級別即可，避免過度蒐集；未授權定位則以 IP 粗略推估。  
高價獎勵  
高價賞品需二階段確認：DrawReserved → FraudPassed → PrizeGranted。  
未通過風控則釋回庫存，並產生客服審查單。

**Scan Event Field**  
**用途**  
**必填**  
scan\_timestamp  
判斷實際飲用/開封節奏與補貨週期  
Y  
device\_info / device\_id  
辨識短時間大量掃碼與裝置關聯  
Y  
geo\_location  
異常地理位置與檔期熱區分析  
N/粗粒度  
risk\_score / risk\_reason  
Dashboard 與 Review Queue 風控依據  
Y  
idempotency\_key  
避免重送 webhook 造成重複入帳  
Y  
code\_verify\_result（Rev B 新增）  
簽章驗證結果（有效/無效/已撤銷批次），無效碼嘗試為窮舉攻擊的早期訊號  
Y

**2.6｜圖鑑、IP 檔期生命週期與戰隊風控｜Rev A**

**圖鑑與典藏館是留存資產，但也是 IP 授權風險最高的區域。素材生命週期、下架權限與戰隊化風控納入 PRD。**

**模組**  
**User Experience**  
**授權/風控邊界**  
IP 素材生命週期  
Campaign 狀態：Draft / Active / Ending / Archived / Hidden。  
每個素材需有 license\_start、license\_end、allowed\_usage、resolution\_limit、post\_campaign\_visibility。  
歷代典藏館  
未獲得該 IP 圖鑑項目的普通用戶，下架後不顯示素材；已解鎖用戶可在典藏館瀏覽低解析度收藏。  
預設下架後自動隱藏；永久可瀏覽僅限已解鎖會員且需符合合約。  
圖鑑剪影  
Active 期間可顯示未解鎖剪影與取得途徑。  
合約未允許剪影/輪廓時，改用通用占位圖，不顯示角色特徵。  
VTuber / 新型態 IP  
支援多角色、多梯次、直播/活動素材與時間窗。  
素材權限需可到角色層與市場層，避免全檔期一刀切。  
戰隊排行榜  
跟團碼升級為戰隊，累積消費、掃碼、任務，達標解鎖戰隊限定賞品。  
限制同裝置/同付款/同地址大量帳號貢獻；退貨時連帶扣除團主與戰隊積分。

**IP Asset Visibility Rule**

If Campaign.status in \[Archived, Hidden\]:

    if member.has\_unlocked(collection\_item) and license.post\_campaign\_visibility \== true:

        show\_low\_resolution\_asset()

    else:

        hide\_asset\_or\_show\_generic\_placeholder()

**Team Anti-abuse Acceptance Criteria**

	•	同一付款卡、收件地址、裝置指紋高度重疊的帳號，戰隊貢獻進入風控權重折減或人工審查。

	•	退貨完成後，團主回饋、戰隊排行、限定賞品資格需同步回算；高價戰隊獎品於鑑賞期/退貨期後才可發放。

	•	排行榜需標示『扣除退貨與風控中訂單後』的有效貢獻，降低爭議。

**2.7｜User Journey 與核心路徑**

**角色**  
**進入動機**  
**核心路徑**  
**2.0 轉換目標**  
ACG IP 新客  
喜歡當期 IP 或周邊。  
Landing → 商品 → Checkout → 掃碼 → 開獎 → 圖鑑 → LINE 綁定。  
從一次性購買轉為會員與二購。  
日常咖啡客  
需要穩定咖啡補貨。  
常態商城 → 自有品牌 → 累積折扣 → 滿額抽獎券 → 當期 IP。  
提升錢包份額與互動。  
收藏型會員  
追求完冊、隱藏款、限定贈品。  
掃碼/抽獎/兌換 → 圖鑑 → 任務 → 優先購。  
提高回訪與跨檔期留存。  
團主/VIP  
帶團、分享、取得優先權。  
跟團碼 → 戰隊 → 排行 → 限定賞池 → VIP 體驗。  
創造裂變與口碑。

**會員中心 2.0 必備卡片**

**卡片**  
**內容**  
**可操作 CTA**  
我的點數  
可用點數、即將到期、差 N 點可兌換  
去兌換 / 去補點  
折扣級距  
365 天累積金額、下一級差距  
購買自有品牌  
當期圖鑑  
解鎖進度、未解鎖取得途徑  
去掃碼 / 去抽獎  
任務  
今日/本週/檔期任務  
開始任務  
跟團/戰隊  
團隊排名、貢獻、獎勵進度  
分享跟團碼

**2.8｜Business Domain Model**

本頁為商業領域模型，不等同於資料庫 Schema。目的是讓 System Architect 確認核心 Entity、Ownership 與上下游關係。

Member

  ├─ Wallet (Point Balance / Expiry / Ledger / Breakage Provision)

  ├─ Segment / Health Score / Tags

  ├─ Collection Book / Badge / Mission Progress

  └─ Team / Referral Code

Campaign

  ├─ IP / License / Market (Locale \+ Compliance Params)

  ├─ Product / SKU / Inventory (gross\_margin\_band / bridge\_weight)

  ├─ QR Batch (signing key version / revocation) / QR Code

  ├─ Prize Pool / Probability / Pity / Last One / EV Validation

  ├─ Mission / Reward Rule

  └─ Notification / Dashboard

Order

  ├─ Member / Channel / Payment / Logistics

  ├─ Order Items / SKU / Discount

  └─ Events: OrderCompleted → BridgeReward → CRM

**Domain**  
**擁有資料**  
**Review 問題**  
Member  
會員身份、LINE 綁定、分層、標籤、健康分數。  
是否需與既有電商會員 ID 合併？  
Wallet  
點數帳本、到期、點加金、兌換紀錄、breakage 準備。  
是否必須財務等級不可竄改 Audit Log？點加金在日本市場的資金決済法定位？（Rev B）  
Campaign  
IP 檔期、素材、期間、規則、市場合規參數。  
多市場是否使用同一 Campaign 模型？  
Reward  
賞品池、機率、庫存、保底、EV 檢核、稽核。  
點數與實體賞品庫存是否同交易更新？發布閘門是否阻擋超限 EV？（Rev B）  
Collection  
圖鑑、徽章、分享卡、完冊獎勵。  
IP 授權素材可使用範圍如何配置？

**2.9｜System Context 與 Boundary**

Customer / Member

  ↓ Web / LINE OA

5min Platform 2.0

  ├─ Payment Gateway

  ├─ Logistics / Warehouse / ERP

  ├─ LINE OA / Email / SMS

  ├─ GA4 / GTM / Meta Pixel

  ├─ Image CDN / Object Storage

  └─ Admin / CMS / Dashboard

**In-house / Core**  
**Third-party / Integration**  
**需架構師確認**  
Campaign Engine  
Payment Gateway  
金流回呼與訂單狀態一致性  
QR Engine  
LINE OA / LIFF / Messaging API  
LINE ID 與會員 ID 綁定流程  
Reward / Wallet  
Logistics / Warehouse / ERP  
賞品庫存、出貨、兌換狀態同步  
Collection / Mission  
GA4 / GTM / Meta Pixel  
事件命名與雙寫策略  
CRM / Health Score  
Email / SMS 備援  
封鎖 LINE 後的溝通與個資合規  
Dashboard / Admin  
CDN / Object Storage  
素材權限、IP 授權到期後的處理

**System Boundary 原則**

	•	Reward、Wallet、QR、Mission、Collection 屬核心差異化能力，建議自建或至少掌控資料模型。

	•	Payment、物流、Email、基礎 Dashboard 可先使用第三方，以降低初期工程成本。

	•	所有第三方回呼需轉為內部標準事件，避免 CRM 與 Dashboard 綁死外部格式。

**2.10｜Reward Engine 高併發、超賣防線與抽獎公平稽核｜Rev C＋Rev D**

**定義高併發下的扣獎原子性：以「記憶體權杖保留層」承接高峰流量，但以不可覆寫的 DB Ledger / Inventory Fact Table 作為最終真相。具體快取／佇列技術選型由 ADR-003 決策（Rev D：本節僅描述能力與責任邊界，不指定產品）。**

**雙層解耦非同步抽獎架構**

User Draw Request → Idempotency Check

  → Prize Token Reservation Layer（記憶體權杖保留層）→ DrawReserved

  → Message Queue → Worker Settlement

  → DB Draw Ledger \+ Inventory Fact Table

  → FraudPassed / PrizeGranted → Notification Broker

**Layer**  
**責任**  
**不可做的事**  
**失敗時處理**  
Reservation Layer  
以原子操作保留賞品權杖，保護高併發下不超賣。  
不得作為財務與庫存最終真相。  
權杖層故障時，抽獎入口降級為排隊或暫停，不可直接打 DB 硬抽。  
Message Queue  
承接 DrawReserved 事件，非同步送入 Worker。  
不得丟失中獎保留事件。  
Retry \+ Dead Letter Queue；超過重試次數轉人工事件。  
Worker Settlement  
寫入 Draw Ledger、扣減 Inventory Fact、更新 Wallet / Collection。  
不得重複入帳。  
依 idempotency\_key 防重；失敗進補償任務。  
DB Ledger / Inventory Fact  
作為庫存、抽獎結果、財務與客服稽核的最終真相。  
不得被手動覆寫抽獎結果。  
每日/每小時 Reconciliation 對帳權杖層、Queue 事件與 DB 事實表。

**Reward Fairness & Audit**

**稽核項**  
**PRD 規格**  
**Acceptance Criteria**  
Probability Snapshot  
每次 DrawReserved 必須鎖定 probability\_version\_id 與 inventory\_snapshot\_id。  
後台機率變更後，歷史抽獎仍可重現當時版本與公示內容。  
Draw Audit Log  
記錄 draw\_id、member\_id、campaign\_id、probability\_version\_id、inventory\_snapshot\_id、token\_id\_hash、random\_seed\_hash、draw\_result、risk\_status、timestamp。  
客服、法務、稽核可追溯單筆抽獎；不得暴露可逆推演算法的敏感 seed。  
Admin Restriction  
後台不得直接指定某會員中獎；補償只能透過補償單或客服補償券。  
任何高價補償需 maker-checker 雙人核准並留 operator\_id / reason\_code。  
Frontend Disclosure  
動態機率池需顯示「依剩餘庫存即時調整」與最近更新時間；固定總大池需顯示大獎是否已抽完。  
前台公示機率版本與後台 probability\_version\_id 可對帳。  
Oversell Prevention  
同一實體 prize\_item\_id 僅可被一個 DrawReserved 持有；過期未完成付款/風控則釋回。  
Inventory Fact Table 不允許同一 prize\_item\_id 被兩筆 PrizeGranted 引用。

**抽獎狀態機與關鍵規則**

Requested → DrawReserved → SettlementPending → FraudPassed → PrizeGranted

Exception: ReservationFailed / FraudReview / ReservationExpired / CompensationRequired

	•	同一 member\_id \+ campaign\_id \+ client\_request\_id 只能產生一筆有效 draw，重送請求必須回傳同一結果。

	•	高價賞品先進 DrawReserved，不直接 PrizeGranted；待風控、付款、庫存與物流確認後授予。

	•	若權杖保留成功但 DB 寫入失敗，系統不得讓用戶重新抽；前台顯示「獎項確認中」，由補償任務完成。

	•	若賞池權杖已空，前端即時回覆售罄或切換 Last One / 完售邏輯。

**2.11｜Team Score Vesting、延遲結算與 Clawback｜Rev C**

**戰隊積分視為需要「託管期」的準資產，避免團主透過人頭刷單、檔期末衝量、領獎後集中退貨來套利。**

**積分狀態**  
**定義**  
**是否列入正式排行**  
**處理規則**  
Pending Points  
訂單已成立但尚未取貨、尚未過鑑賞期、付款仍可能 reversal。  
否  
可在前台顯示為預估貢獻，不得決定最終名次或領獎資格。  
Confirmed Points  
已付款、已取貨、過鑑賞期/退貨期，且未命中高風險關聯。  
是  
正式計入戰隊排行、團主回饋與限定賞資格。  
Frozen Points  
付款、地址、裝置、退貨率或異常行為命中風控。  
否  
等待人工審查或自動風控解除；不得發放高價戰隊獎品。  
Reversed Points  
訂單取消、退貨、chargeback、付款失敗或作弊確認。  
否  
100% 扣回，並重算團主回饋、戰隊級距與已解鎖權益。

**結算與 Clawback 規則**

	•	排行榜可顯示「預估排行」與「正式排行」兩種視圖，預估排行必須標示含 Pending Points。

	•	當期 IP 檔期結束後 N+14 天進行正式結算；N 由市場別/品類別設定，台灣初始建議 14 天。

	•	高價戰隊限定賞僅能在正式結算後發放；若法規或通路退貨期更長，需套用較長的市場參數。

	•	若退貨或 chargeback 使戰隊跌出級距，系統自動取消未發放獎勵；已發放獎勵進入 Clawback Review。

	•	團主回饋與戰隊積分使用同一套事件來源，避免顯示與財務結算不一致。

ReturnCompleted / ChargebackConfirmed → ReverseOrderContribution

  → Move Confirmed/Pending → Reversed → Recalculate Team Rank and Tier

  → Freeze Unclaimed Rewards → If granted: Clawback Review Case → Notify Team Owner

**風控場景**  
**系統反應**  
**Owner**  
同一地址/付款卡/裝置大量帳號集中貢獻  
貢獻先進 Frozen Points，排行中以折減權重或不計入正式分數。  
Risk / CRM Owner  
檔期最後 24 小時異常暴增  
提升 Team Risk Score；高價獎延遲發放；必要時凍結排行榜。  
Ops \+ Tech Lead  
領獎後大量退貨  
觸發 Clawback Review；後續戰隊活動可限制參與資格。  
Finance \+ Legal \+ Ops

**Part 3｜CRM 客戶分層與 LINE OA 營運**

**六層客戶生命週期分層保留。分層是『狀態』，Health Score 是『溫度』；兩者搭配才能精準判斷應該喚醒、補貨、升級或降低溝通頻率。**

**分層**  
**操作型定義**  
**CRM 目標**  
New  
首次完成訂單起 90 天內，累積訂單數\=1。  
LINE 綁定、首掃、二購。  
Repeat  
累積訂單≥2，且最近一次訂單≤90 天。  
提高回購頻率、跨軌轉換、任務活躍。  
VIP  
Repeat 中 365 天累積消費≥15,000。  
優先購、完冊獎勵、社群口碑。  
One-time  
累積訂單\=1，首購超過 90 天。  
低成本挽回、重新啟動。  
Inactive  
曾為 Repeat，最近訂單 91–180 天；近 30 天有掃碼則標記消耗中。  
補貨提醒、點數到期、低壓喚醒。  
Churned  
最近訂單\>180 天且近 60 天無掃碼。  
只在大檔 IP 精準喚回。

**分層遷移北極星**

	•	健康流動：New → Repeat → VIP。

	•	危險流動：New → One-time、Repeat → Inactive → Churned。

	•	Dashboard 應優先呈現流動，而不是只呈現各層存量。

**3.6｜Customer Health Score 與 Retention Grade（單一公式）｜Rev D 統一**

**Rev D 收斂：全平台只有一套會員熱度評分。**Health Score 為唯一數值公式；Retention Grade（A/B/C/D/X）僅為其字母等級視圖，兩者不得各自定義權重。此公式同時供 CRM 劇本、Tier 升級條件（見 3.9）與戰隊貢獻折減（見 3.9.4）引用——單一真相，三處復用。權重存設定表，上線兩季後以實際數據回測校準。

**Score Component**  
**初始權重（可調參數）**  
**資料來源**  
**判讀**  
Purchase Recency  
25%  
訂單事實表  
最近購買時間與回購間隔。  
Scan Frequency  
25%  
掃碼事件表  
實際飲用/開封節奏。  
Refill Cadence  
15%  
掃碼×訂單推估  
是否接近日常咖啡補貨週期。  
Collection / Mission  
15%  
圖鑑/徽章/任務事件  
收藏、完冊與回訪意圖。  
LINE Engagement  
10%  
LINE 開啟/點擊/封鎖  
可溝通程度；封鎖直接扣分。  
Churn Risk  
10%  
分層遷移訊號  
是否接近 Inactive / Churned。

Health Score（0-100）\= Σ weighted components（權重存設定表）

Retention Grade 視圖：A 80-100 高活躍/升溫｜B 60-79 穩定｜C 40-59 降溫

                      D 0-39 高風險｜X 封鎖/不可溝通（獨立狀態，非分數區間）

**Trigger Examples**

	•	Repeat \+ Grade C：推補貨提醒或任務，不直接發大折扣。

	•	Inactive \+ 近 30 天有掃碼：標記消耗中，推補貨而非喚醒券。

	•	VIP \+ Grade A：推優先購、完冊獎勵、戰隊挑戰。

	•	Grade X（LINE 封鎖/拒收）：停止行銷推播，改 Email/SMS 備援或人工審查；不計入戰隊核心貢獻。

**3.7｜LINE OA 事件觸發與分層重算時間差處理｜Rev A**

**明確區分『即時營運互動』與『夜間分析重算』：掃碼、結帳、兌換等核心行為必須走事件驅動並讀取現時狀態；遷移矩陣、LTV 與複雜分層則每日批次校正。**

**類型**  
**處理方式**  
**避免的錯誤**  
即時事件  
QRCodeScanned、OrderCompleted、PointExpiring、PrizeGranted 立即觸發 LINE/Email，但先讀取 current\_member\_state。  
避免中午已掃碼/消費，仍被夜間舊標籤誤發 Inactive 喚醒訊息。  
每日批次  
每日夜間重算六層分群、遷移矩陣、LTV、Health Score 校正值。  
避免即時計算過重，保持 Dashboard 與 CRM 分層一致。  
標籤同步  
Event-driven 暫時標籤（temporary flags）即時寫入；正式 segment 次日批次覆蓋。  
避免 LINE OA 標籤延遲導致錯誤劇本。  
頻控與優先級  
同一會員同週最多 2 則；高優先事件（點數到期、開獎結果）高於促銷群發。  
避免訊息疲勞與封鎖率上升。

**事件**  
**即時訊息**  
**資料讀取**  
QRCodeScanned  
開獎結果、圖鑑進度、下一個任務  
current\_wallet \+ collection\_progress \+ risk\_status  
OrderCompleted  
升級進度、自有品牌/聯名橋接提醒  
current\_tier \+ eligible\_spend \+ bridge\_weight  
PointExpiring30/7  
差 N 點可兌換 X  
current\_wallet \+ redemption\_candidates  
SegmentBatchUpdated  
僅更新後台分層與名單，不直接群發  
nightly\_segment \+ migration\_matrix

**3.8｜Notification Broker：全域調度、優先權與冷卻閘門｜Rev C**

**任何功能模組不得直接對 LINE OA 發送行銷或服務推播；所有訊息必須經過中央 Notification Broker，統一執行同意、頻控、優先權、冷卻與熔斷。訊息層級的封鎖率熔斷（單週 \+1% 或單月 \+2% 自動暫停 Level 3 劇本）由 Broker 統一執行，劇本封鎖歸因回寫至 Template ID 供 A/B 與停用判斷。**

Feature Event → Notification Broker

  → Consent & Preference Check → Priority Ranking → Global Frequency Cap

  → Cool-down Window → Buffer Queue / Suppression / Immediate Send

  → LINE OA / Email / SMS → Delivery & Block Attribution

**Priority**  
**訊息類型**  
**範例**  
**可否突破冷卻**  
**規則**  
Level 1  
資產/交易/風險  
點數到期、獎品確認、訂單異常、付款/出貨通知。  
可  
不得被行銷冷卻阻擋，但仍需避免重複發送。  
Level 2  
服務/補貨/級距  
補貨提醒、折扣升級、任務完成、圖鑑完冊。  
部分可  
需遵守週頻控；若與 Level 1 同日，可延後。  
Level 3  
行銷/活動/戰隊動態  
新 IP 上檔、促銷、戰隊排行榜、一般活動推播。  
不可  
進入 24 小時冷卻與全域每週上限；封鎖率升高時最先熔斷。

**全域頻控與緩衝佇列**

	•	同一會員 72 小時內推播數、7 天內推播數、同類型訊息數，均由 Broker 統一判定。

	•	任一使用者收到 LINE 推播後，預設進入 24 小時 cool-down window；Level 1 訊息例外，Level 2/3 需延後或合併。

	•	若同日存在多個可發訊息，Broker 按 priority\_score、expiry\_urgency、member\_health、commercial\_value 排序，只發最高價值訊息。

	•	被延後的訊息進 Buffer Queue，過期後自動丟棄；不得累積成隔日訊息轟炸。

	•	每個 Template ID 都需回寫開啟、點擊、封鎖、轉換，供熔斷與 A/B 判斷。

**Consent & Preference Center**

**訊息類型**  
**是否可關閉**  
**渠道**  
**治理原則**  
Transactional  
不建議關閉  
LINE / Email / SMS  
訂單、付款、出貨、退貨、帳本異動；屬服務必要通知。  
Reward / Service  
可部分關閉  
LINE / Email  
開獎結果、點數到期、補貨提醒；需允許使用者降低頻率。  
Marketing  
必須可關閉  
LINE / Email  
新 IP、促銷、戰隊活動；需遵守同意與退訂。  
Personalized Tracking  
需告知  
Preference Center  
掃碼頻率、偏好標籤、Health Score 用途需於隱私告知揭露。

**3.9｜Member Tier、Retention Grade 與 Team Synergy｜Rev C＋Rev D 收斂**

會員等級不應只以消費金額判定。會員制度同時評估「個人貢獻度」「留存健康度」「社群影響力」，形成可營運、可防弊、可與戰隊制協同的治理模型。

**層級**  
**回答的問題**  
**主要用途**  
Lifecycle Segment  
會員現在處於 New、Repeat、VIP、Inactive 或 Churned 哪一階段？  
CRM 劇本與溝通策略。  
Contribution Tier  
會員對平台的有效貢獻有多高？  
個人等級、折扣、優先權、VIP 候選。  
Retention Grade  
會員正在升溫、穩定、降溫或流失嗎？（＝Health Score 字母視圖，見 3.6）  
補貨、任務、喚醒、降低打擾頻率。  
Team Confirmed Score  
會員對戰隊與社群裂變的已確認貢獻是多少？  
戰隊排行、戰隊任務、戰隊限定賞池。  
Risk / Return Status  
此會員或戰隊貢獻是否需凍結、折減或扣回？  
防刷單、退貨扣回、clawback。  
**治理原則：個人等級決定身份，留存等級決定溫度，戰隊等級決定社群影響力。三者互相協同，但不得互相替代。**

**3.9.0｜折扣級距整併與遷移（Rev D 新增，最高優先）**

**定位裁決：現行 365 天累積折扣級距（9 折→7 折）自 Tier 制上線起不再是獨立系統，而是 Contribution Tier 的權益輸出之一。**全平台會員狀態收斂為三軸（Tier／Grade／Team Role），折扣由 Tier 映射產生——避免在解決 1.0「三軌並行認知負擔」的專案裡，親手造出第四條階梯。

**Tier → 折扣映射（完整六級制，Phase 3）**

**Contribution Tier**  
**名稱**  
**自有品牌折扣權益**  
**對應舊級距**  
Tier 0  
Visitor / New  
無  
—  
Tier 1  
Bean  
無（享迎新任務與點數）  
—  
Tier 2  
Brewer  
9 折  
累積 1,000 元  
Tier 3  
Roaster  
8 折  
累積 3,500 元  
Tier 4  
Master  
75 折  
累積 15,000 元  
Tier 5  
Legend  
7 折  
累積 25,000 元

**既有會員遷移規則（消費者承諾保護）**

	•	轉換原則「就高不就低」：以既有 365 天累積金額對照上表直接授予對應 Tier；既有 75 折會員直接落位 Master，不需重新滿足 Tier 的多維條件。

	•	既得權益保障（grandfathering）：轉換後 365 天內，折扣不低於轉換前級距——即使多維評分未達標也不降級，保障期滿後才按 Tier 規則常態計算。「滿 15,000 享 75 折」是對消費者的既有承諾，新制只能加值、不能收回。

	•	對外溝通定調：「等級升級、權益不縮水」——舊級距自動變成新等級，並額外獲得任務、圖鑑、戰隊等新權益；升級門檻的多維化只對『未來的升級』生效，不追溯既有身份。

	•	Tier 降級規則：常態期以 365 天滾動視窗重算，降級前 30 天推播預警（Level 2）並提示補足差額；單季最多降一級，避免斷崖式體驗。

**3.9.1｜Contribution Score 與會員貢獻等級**

貢獻度不等於消費金額。Contribution Score 以毛利貢獻、日常咖啡回購、掃碼飲用活躍、收藏/任務互動，以及已確認的推薦/戰隊貢獻共同計算。自有品牌咖啡的權重高於聯名商品，因為自有品牌代表留存與毛利基礎。

**貢獻項目**  
**初始權重（可調參數）**  
**資料來源**  
**規則邊界**  
自有品牌咖啡實付毛利  
35%  
訂單事實表 / SKU 毛利帶  
最高權重，代表日常飲用與毛利基礎。  
聯名商品有效消費  
20%  
訂單 \+ bridge\_weight  
依 bridge\_weight 計入，不得 1:1 推升高階會員。  
QR 掃碼 / 飲用活躍  
15%  
掃碼事件表  
代表開封/飲用，不等於可直接折抵財務權益。  
圖鑑 / 任務完成  
10%  
Collection / Mission Events  
代表收藏與回訪意圖。  
跟團碼 / 戰隊有效貢獻  
15%  
Team Confirmed Points  
只計 Confirmed，不計 Pending/Frozen。  
LINE / 會員資料完整度  
5%  
LINE / Profile  
代表可溝通資產，封鎖或拒收需扣分。

	**•	硬性防線：**非付費互動分數（掃碼、任務、分享、LINE）最多只能佔升等所需貢獻分數的 40%，避免只靠刷任務或刷掃碼衝高會員等級；聯名商品只能依 bridge\_weight 觸發或推進會員貢獻，高階等級需由自有品牌咖啡的實際有效消費與留存行為共同達成。

	**•	升級雙條件：**會員升級需同時符合 Contribution Score 門檻與 Retention Grade B 以上，不得只靠消費或只靠任務。

**3.9.2｜分階段啟用（Rev D 新增）**

**階段**  
**啟用範圍**  
**說明**  
Phase 1-2（上線期）  
三級簡化版：Bean（Tier 0-1 合併）／Roaster（Tier 2-3 合併）／Legend（Tier 4-5 合併）  
遷移映射：舊 9 折與 8 折落位 Roaster（保障期內折扣按原級距給付）、75 折與 7 折落位 Legend。三級制降低會員教育成本與工程範圍，先驗證評分公式與遷移機制。  
Phase 3（戰隊化）  
展開完整六級＋戰隊倍率制＋戰隊角色權限  
以兩季實際數據回測後校準權重與倍率；六級展開時只升不降（三級內部細分，不影響既有權益）。  
所有權重、倍率、門檻均存設定表；本文件所列數字為初始建議值，非承諾參數。

**3.9.3｜戰隊與會員等級的協同**

Team Score \= Σ Confirmed Member Contribution \+ Team Mission Bonus \+ Collection Completion Bonus − Return / Chargeback / Abuse Penalty

**個人等級（Phase 3 六級制）**  
**戰隊貢獻倍率上限**  
**設計目的**  
Bean  
1.00x  
基礎會員，不放大貢獻。  
Brewer  
1.05x  
鼓勵二購與穩定參與。  
Roaster  
1.10x  
鼓勵自有品牌回購與跨軌消費。  
Master  
1.15x  
鼓勵高貢獻會員協助戰隊任務。  
Legend  
1.20x  
品牌大使級；上限 1.20x，避免鯨魚玩家壟斷排行榜。

**Retention Grade**  
**戰隊貢獻處理**  
A / B  
100% 計入，並可參與高階任務。  
C  
80% 計入，系統推補貨 / 任務刺激。  
D  
50% 或暫緩計入，需觀察是否為休眠或人頭帳號。  
X  
不計入，因不可溝通或高風險。  
此折減規則是防弊的核心：人頭帳號的天然特徵即低留存（不掃碼、不互動、未綁定），其戰隊貢獻在計分公式中自動稀釋，無需風控逐一點名。

**戰隊角色**  
**條件**  
**權益**  
Captain 團主  
Brewer 以上且 Risk Status 正常  
建立戰隊、分享跟團碼、啟動基礎戰隊任務。  
Core Member 核心隊員  
Roaster 以上  
開啟進階任務、提高戰隊任務完成效率。  
Strategist 戰隊幹部  
Master 以上  
協助管理戰隊任務與邀請名單。  
Ambassador 品牌大使  
Legend \+ Retention A/B  
參與 VIP 活動、下檔期優先體驗與品牌共創。

**戰隊獎勵邊界與 Dashboard 指標**

**戰隊成果**  
**建議回饋**  
**財務/風控邊界**  
完成掃碼任務  
全隊限定徽章 / 小額點數  
點數成本需進入 Reward Budget。  
完成圖鑑挑戰  
限定抽選資格  
不直接給高額折扣。  
排名前 10%  
下檔 IP 優先購  
資格需於 N+14 Confirmed 後確認。  
排名前三  
戰隊限定賞池  
高價賞需過退貨期與風控審查。  
高留存戰隊  
團主品牌大使候選  
需同時滿足低退貨率與低封鎖率。  
	•	Dashboard 新增指標：Contribution Tier Distribution（會員價值結構）、Retention Grade Migration（升降溫遷移）、Team Pending vs Confirmed Ratio（刷單與退貨風險偵測）、Tier Upgrade Cost（每升一級的獎勵/折扣成本）、Team Reward ROI（戰隊獎勵成本 ÷ 戰隊增量毛利）。

	•	會員等級每晚批次重算；核心事件可即時刷新暫時狀態，但正式級距以批次結果為準。任何人工調整會員等級或戰隊分數，必須留 audit log 與 reason\_code。

**Part 4｜KPI 即時儀表板規格**

儀表板不應只呈現結果，還需支持檔期作戰、CRM 分層、平台健康與架構監控。三速架構保留：分鐘級、每日批次、每週/月報。

**Dashboard Page**  
**主要用途**  
**核心指標**  
經營總覽  
每日看板，讓管理層掌握平台狀態。  
MACM、二購率、Repeat+VIP 占比、營收、自有品牌占比、LINE 封鎖率。  
分層明細  
CRM 團隊下鑽會員名單。  
六層結構、遷移矩陣、消耗中子狀態、Health Score 分佈。  
LINE OA 成效  
追蹤劇本效果與封鎖風險。  
發送、開啟、點擊、30 天轉換、封鎖歸因。  
檔期作戰室  
IP 檔期期間近即時監控。  
SKU 售罄倒數、掃碼熱度、新客綁定率、賞池抽取、Last One 倒數。  
Platform Health  
供技術/架構監控。  
API 成功率、QR 成功率、無效碼嘗試率（Rev B）、Reward 一致性、事件延遲、告警。

Events / Orders / LINE / QR / Wallet → Event Store / Data Warehouse

  → Daily ETL \+ Near Real-time Views → Business Dashboard \+ Platform Health \+ Alerts

**4.5｜Platform KPI、賞池同步、合規閘門與熔斷機制｜Rev A＋Rev B**

**PRD 不只定義『告警』，也必須定義告警後的自動後置動作，以及發布前的機器合規檢核。**

**賞池發布合規閘門（Rev B 新增）**

	•	賞池發布流程內嵌市場別 EV 檢核：後台儲存各 Market\_ID 的給獎價值上限參數，發布前自動驗算，超限配置阻擋發布並顯示具體超限項目——合規由程式碼強制，不依賴人工檢查。

	•	日本市場（Market=JP）初始參數：一般懸賞單一獎品價值 ≤ 交易額 20 倍且 ≤ 10 萬日圓；獎品總額 ≤ 賞池對應預期銷售額 2%。參數存設定表，由法務確認後鎖定，修改需雙人核准並留審計紀錄。

	•	檢核演算法輸入：賞池全獎項市價、機率分布、預期銷售額、商品單價；輸出：通過／阻擋＋超限明細。台灣市場依消保規範另掛參數；未設定合規參數的市場不得發布賞池。

**監控與熔斷（Rev A）**

**監控項**  
**觸發條件**  
**自動後置動作**  
LINE 封鎖率  
單週 \+1% 或單月 \+2%  
自動暫停低優先群發劇本；保留交易/服務型訊息；通知 CRM Owner 審查。  
Repeat→Inactive 異常  
月遷移率 \> 近 6 月均值 \+ 2SD  
產生 Cohort Drilldown；暫停無差別促銷，改採補貨/點數到期分眾。  
QR 風控  
高風險掃碼超過活動基準  
高價獎品暫停即時發放，轉 Review Queue；低價點數可延遲入帳。  
無效碼嘗試率（Rev B）  
簽章驗證失敗率超過基準（窮舉攻擊訊號）  
自動調升該來源風控等級；持續異常時通知資安並評估批次撤銷。  
Reward 一致性  
點數帳本/獎品庫存不一致  
凍結相關賞池；停用抽獎入口；開啟補償任務。  
API / Event Delay  
事件入庫延遲 \>5 分鐘  
Dashboard 顯示資料延遲警示；暫停依延遲事件觸發的行銷訊息。

**Gacha 庫存情境**  
**系統邏輯**  
**前台揭露**  
動態機率池  
A 賞庫存\=0 時，A 賞機率歸零，其餘 B\~E 按原權重等比放大。  
即時更新機率公示與剩餘庫存。  
固定總大池  
A 賞抽完後不調整機率，改顯示大獎已抽完；依規則觸發 Last One 或完售邏輯。  
前台明示『本期大獎已全數抽出』，避免消費爭議。  
高價賞保留  
抽中後先 DrawReserved，通過風控/付款/庫存確認後 PrizeGranted。  
顯示『獎項確認中』，不得重新抽取。

**Platform KPI 補充**

	•	QR Scan Success Rate \>99%；Reward/Wallet Consistency 必須 100%。

	•	Campaign Config Error 必須 0 critical；缺機率公示、授權期限或市場合規參數不得發布（Rev B 擴充）。

	•	Event Ingestion Delay 分鐘級 \<5 min；超標時所有即時分眾行銷需暫緩。

**4.6｜Compliance Rule Engine：市場別法規公式鎖｜Rev C**

**將 Rev B 的 EV 發布閘門抽象為 Compliance Rule Engine：營運上架賞池、點數、點加金與總付景品時，必須先通過市場別規則驗算。是否獨立服務化留待 SAD / ADR-008 決策，本 PRD 僅要求規則引擎能力。**

**法條修正（Rev C 關鍵貢獻）：**掃碼「必得」隨機點數屬人人有獎，在日本景品表示法上為総付景品而非一般懸賞——適用獨立上限（交易額 \<¥1,000 → 景品上限 ¥200；≥¥1,000 → 交易額 20%）。一般懸賞規則（20 倍／10 萬円／2%）僅適用抽選型賞池。兩條規則分域建置，Rev B 僅編一般懸賞規則之閘門據此擴充。

**Rule Domain**  
**Key Params**  
**Fail Action**  
**Owner**  
Market Scope  
country\_code、market\_id、currency、locale、minor\_protection\_flag。  
未設定市場參數不得發布 Campaign / Prize Pool。  
Product \+ Legal  
General Lottery 一般懸賞 JP（抽選型賞池）  
max\_single\_prize \= min(交易額 × 20, ¥100,000)；total\_prize\_value ≤ 預期銷售額 × 2%。  
超限阻擋發布，顯示超限項目與可調整建議。  
Legal \+ Ops  
General Premium 総付景品 JP（掃碼必得點數/人人有獎）  
交易額 \<¥1,000 → 景品上限 ¥200；≥¥1,000 → 交易額 20%。  
掃碼必得點數或人人有獎 EV 超限時阻擋。  
Legal \+ Finance  
Payment Services Act JP  
point\_source 無償/有償、點加金市場別開關、未使用餘額與供託評估。  
日本市場付費點數與點加金預設關閉，法務核准後方可啟用。  
Legal \+ Finance  
IP License Policy  
license\_start/end、usage\_scope、resolution\_limit、post\_campaign\_visibility。  
素材過期自動隱藏、停止生成分享卡與 OG 圖。  
IP Owner

**Prize\_Pool\_Config 解耦原則**

	•	Prize\_Pool\_Config 不得硬編碼台灣邏輯；所有賞池必須綁定 market\_id 與 compliance\_policy\_id。

	•	合規參數修改需雙人核准：Legal Approver \+ Business Owner；所有修改寫入不可覆寫 Audit Log。

	•	若營運人員複製台灣賞池至日本市場，系統需重新執行 JP 法規公式鎖，不得沿用 TW 通過狀態。

	•	未成年保護、每日購買上限、單會員抽獎上限列為市場別參數，SAD/TDS 定義實作細節。

Compliance Check before Publish:

  input: market\_id, transaction\_value, expected\_sales, prize\_values,

         probability\_distribution, point\_source, premium\_type(lottery|general)

  rules: MarketCompliancePolicy(market\_id)

  output: PASS / BLOCKED

  if BLOCKED: show rule\_id, violated\_value, allowed\_value, required\_approver

**4.7｜Incident Runbook 與 ADR Candidate｜Rev C**

**每個熔斷必須對應負責人、SLA、解除條件與後續 ADR 決策——沒有 Owner 和解除條件的告警，三個月後就是被靜音的告警。**

**Incident**  
**系統動作**  
**Owner**  
**SLA**  
**解除條件**  
LINE 封鎖率暴增  
暫停 Level 3 行銷劇本，保留交易型訊息。  
CRM Owner  
2 小時  
完成 Template ID 封鎖歸因分析並調整頻控/文案。  
Reward / Wallet 不一致  
凍結相關賞池與兌換入口，停止即時發放。  
Tech Lead \+ Finance Ops  
30 分鐘  
Draw Ledger、Wallet Ledger、Inventory Fact 對帳通過。  
無效碼嘗試暴增  
提升風控等級、啟用 captcha、必要時批次撤銷。  
Security / Tech Lead  
30 分鐘  
來源被阻擋或批次撤銷完成，風險指標回落。  
EV 超限或合規參數缺漏  
阻擋 Campaign / Prize Pool 發布。  
Legal \+ Product Owner  
發布前  
MarketCompliancePolicy 通過並留雙人核准紀錄。  
IP 授權到期  
自動隱藏素材、停止分享卡與 OG 生成、清 CDN 快取。  
IP Owner \+ Ops  
到期前完成  
合約展延或下架檢核清單完成。  
Queue / Event Delay \> 5 min  
暫停依即時事件觸發的行銷訊息，Dashboard 顯示延遲。  
Tech Lead  
30 分鐘  
Event latency 回到門檻內，補償任務完成。

**ADR Candidate List for SAD**

**ADR**  
**待決策事項**  
**為何重要**  
ADR-001  
Modular Monolith vs Microservices  
決定 2.0 初期工程複雜度、部署與團隊維運成本。  
ADR-002  
Wallet Ledger 是否採 Event Sourcing  
影響點數、breakage、退貨扣回與財務對帳可追溯性。  
ADR-003  
Reward Draw 的 transaction boundary（含權杖層／佇列技術選型）  
決定保留層、Queue、DB Ledger 之間的一致性與補償策略。  
ADR-004  
QR Code 是否出貨/入倉後才 activate  
決定供應鏈外洩與上架前被掃碼的防線。  
ADR-005  
Notification Broker 是否作為所有渠道唯一出口  
決定 LINE 疲勞轟炸與封鎖率治理能力。  
ADR-006  
Dashboard 使用現成 BI 工具或自建  
決定初期交付速度與後期作戰室客製化能力。  
ADR-007  
IP Asset Policy 是否採 signed URL \+ policy engine  
決定素材授權到期後的真實下架能力。  
ADR-008  
Compliance Rule Engine 是否獨立服務化  
決定台日市場差異與未來多市場擴張的可維護性。

**5.1｜日本市場合規防線：資金決済法優先｜Rev B 新增**

**日本法遵清單第一位不是景品表示法，而是資金決済法（Payment Services Act）——它決定日本版點數商品可以長什麼樣子，必須在 SAD 之前定案，因為結論會改變 Wallet 與點數商城的領域模型。**

**點數取得方式**  
**資金決済法定位（需法務確認）**  
**系統設計含義**  
免費掃碼贈點、任務贈點、消費回饋點  
無償ポイント，原則上不構成前払式支払手段。  
日本市場可保留完整掃碼贈點迴路，為安全區。  
點數加現金（點加金）兌換  
現金部分屬一般買賣，但若點數本身涉及付費取得或可儲值，可能構成前払式支払手段。  
日本市場預設關閉「付費取得點數」；點加金保留與否取決於法務對混用模式的認定。  
付費購買點數／點數儲值（若未來規劃）  
高度可能構成前払式支払手段：發行額超過基準即觸發登記義務＋未使用餘額 50% 供託（保證金）。  
除非商業上必要且完成登記評估，日本版不開放付費點數。

**產品規則（Rev B）**

	•	Wallet 增加 point\_source 維度（無償／有償），兩類點數分帳本記錄、分別統計餘額——即使台灣現行不區分，資料模型自 Phase 1 即預留，避免日本上線前重構帳本。

	•	點數商城的「點加金」功能掛市場別開關：台灣沿用現行模式；日本市場預設關閉，待法務出具意見後由設定開啟。

	•	點數效期、失效規則於日本市場需同步檢視特定商取引法與消費者契約法之表示義務（細部條文由法務出具意見）。

	•	日本線上 oripa／機率型商品市場近年處於監管收緊期，進場合規姿態應保守：機率公示、EV 上限、未成年保護（購買上限）均以高標準內建。

**法遵時序**

	•	資金決済法認定（點數商品形態）→ 景品表示法參數（賞池 EV 上限）→ APPI／個資（掃碼數據）→ 特商法表示義務。前者是後三者的前提：點數商品形態未定，賞池與溝通設計都可能重工。

**Part 5｜整合時程、風險與 Review Gate**

**階段**  
**時間**  
**產品交付**  
**架構 / 數據交付**  
Phase 0 技術淨化＋數據奠基  
Aug 2026  
移除 jsessionid、OG meta 動態化、會員中心整合頁。  
資料模型建立（含 point\_source 維度與 breakage 欄位，Rev B）、分層 SQL、Metabase 總覽頁、掃碼中台盤點。  
Phase 1 掃碼中台＋開獎引擎  
Sep 2026  
一碼一用、掃碼即開獎、統一賞品池、機率公示。  
碼簽章生成與驗證（Rev B 驗收條件）、掃碼事件入庫、Reward 稽核、EV 發布閘門、檔期作戰室 v1、breakage 認列政策定案。  
Phase 2 圖鑑＋跨軌橋接  
Q4 2026  
收藏圖鑑、橋接 A/B、點數到期提醒。  
遷移矩陣告警、分層下鑽、全分層劇本、退貨扣回鏈驗收。  
Phase 3 戰隊化＋日本合規  
Q1 2027 前  
戰隊、日文介面、日本市場合規參數（資金決済法→景表法→APPI 時序，Rev B）。  
日本市場看板、分市場分層參數、後台整合。

**主要風險與控制**

**風險**  
**說明**  
**控制方式**  
日本資金決済法（Rev B，日本法遵第一位）  
點加金／付費點數可能構成前払式支払手段，觸發登記義務與未使用餘額 50% 供託。  
point\_source 分帳本、點加金市場別開關、法務認定先於 SAD；詳見 5.1。  
法規風險（景表法／消保）  
掃碼隨機點數、盲盒、賞品池涉及機率揭露與贈品價值限制。  
EV 上限機器檢核內建發布閘門（Rev B）；機率公示為必填；台日分別法務審查。  
QR 安全  
碼可枚舉時點數池可被無成本掃空；一碼一用涉及可變印刷與包材成本。  
簽章生成＋批次撤銷（Rev B）；行為側風控門檻；先以盒內卡/貼標試行，成功後導入包裝直印。  
IP 授權  
圖鑑、分享卡、開獎動畫涉及素材二次利用。  
素材生命週期五欄位、visibility rule、逐檔合約確認。  
毛利影響  
聯名消費計入折扣累積會改變成本結構。  
bridge\_weight 掛毛利帶、9 折級距天花板、退貨扣回、歷史訂單回測。  
財務認列（Rev B）  
未被掃描的碼對應之未實現點數屬遞延負債。  
breakage 估算入月結報表、認列政策 Phase 1 前定案。  
資料與個資  
掃碼可推知飲用習慣與地理行為。  
告知義務、最小蒐集（geo 粗粒度）、權限與 Audit Log；日本市場符合 APPI。

**Review Gate**

PRD v1.1 Final Rev D → Architecture Review → SAD → TDS → Codex Development Specification

**Appendix｜Architecture / Audit Review Checklist（合併版）｜Rev D**

本清單供 System Architect、Tech Lead、CRM Owner、財務與法務共同確認。Rev B 新增列標註★、Rev C 標註◇、Rev D 標註◆。

**Review Area**  
**必須回答的問題**  
**狀態**  
雙軌財務防線  
聯名消費是否採非 1:1 計入？是否限制只能啟動 9 折？退貨時點數/券/級距是否扣回或凍結？  
□  
QR 碼生成安全 ★  
碼值是否以簽章生成、不可枚舉？是否有金鑰輪替與批次撤銷？無效碼嘗試是否入庫並監控？  
□  
QR 行為風控  
同 IP/裝置/會員的 X 分鐘 Y 次門檻是否可配置？是否有 captcha、暫鎖、Review Queue？  
□  
掃碼欄位  
scan\_timestamp、device\_info、geo\_location、risk\_score、idempotency\_key、code\_verify\_result 是否入庫？  
□  
Reward 高併發 ◇  
權杖保留層是否只作 reservation？DB Ledger / Inventory Fact 是否為最終真相？技術選型是否留 ADR-003？  
□  
Reward Fairness ◇  
每筆抽獎是否鎖定 probability\_version\_id、inventory\_snapshot\_id、Draw Audit Log？Admin 是否無法指定中獎？  
□  
Oversell Prevention ◇  
同一 prize\_item\_id 是否不可能被兩筆 PrizeGranted 引用？超賣時是否有補償流程？  
□  
Gacha 庫存/機率  
實體庫存降為 0 時採動態機率調整或固定大池公告？Last One 觸發邏輯是否明確？  
□  
賞池合規閘門 ★  
發布流程是否內嵌市場別 EV 上限自動驗算？超限是否阻擋發布？合規參數修改是否雙人核准？  
□  
総付景品規則 ◇  
掃碼必得點數是否依総付景品規則（\<¥1,000 → ¥200；≥¥1,000 → 20%）檢核，而非誤用一般懸賞規則？  
□  
資金決済法 ★  
point\_source（無償/有償）是否分帳本？點加金是否掛市場別開關？日本點數商品形態是否已由法務認定？  
□  
Breakage 認列 ★  
未掃碼對應之遞延負債估算與認列政策是否與財會定案？月結報表是否呈現點數負債餘額？  
□  
Team Vesting ◇  
Pending / Confirmed / Frozen / Reversed Points 是否定義？正式排行是否只看 Confirmed？N+14 結算是否落地？  
□  
Team Clawback ◇  
退貨/chargeback 是否能連帶扣回團主回饋、戰隊排行與限定賞資格？  
□  
Notification Broker ◇  
所有 LINE / Email / SMS 推播是否都必須經過中央 Broker？功能模組是否禁止直發？  
□  
Global Frequency Cap ◇  
72 小時頻控、24 小時 cool-down、Level 1/2/3 優先權與 Buffer Queue 是否定義？  
□  
Consent Center ◇  
Transactional、Reward / Service、Marketing、Personalized Tracking 是否分開治理？  
□  
級距整併與遷移 ◆  
折扣級距是否已定位為 Tier 權益輸出？既有會員是否就高轉換並享 365 天 grandfathering？降級預警是否定義？  
□  
單一評分公式 ◆  
Health Score 是否為全平台唯一熱度公式？Retention Grade 是否僅為其字母視圖？權重是否存設定表？  
□  
Tier 分階段啟用 ◆  
上線期是否為三級簡化版？六級與倍率制是否延至 Phase 3？展開時是否只升不降？  
□  
Tier 防弊 ◇  
非付費互動是否 ≤40% 升等分數？聯名是否無法 1:1 推升高階？倍率是否 ≤1.20x？Grade 折減是否生效？  
□  
IP 授權生命週期  
檔期下架後素材是否自動隱藏？已解鎖用戶是否僅能低解析度瀏覽？剪影未授權時是否退通用占位圖？  
□  
LINE 時間差  
即時事件是否讀 current\_member\_state？夜間批次是否只負責遷移矩陣與 LTV 校正？  
□  
Incident Runbook ◇  
每個告警是否有 Owner、SLA、解除條件與後續追蹤？ADR 待決事項是否移交 SAD？  
□  
Compliance  
台灣個資法、日本 APPI、景品表示法、特商法表示義務是否納入設計？法遵時序是否以資金決済法為先？  
□  
Migration  
舊點數、既有會員、歷史訂單、舊 QR 是否有過渡與補償策略？  
□

**Next Deliverables**

	•	SAD：補 C4 Context/Container、模組邊界、事件流、資料一致性與 ADR（含碼簽章演算法、EV 檢核實作、point\_source 帳本設計）。

	•	TDS：補 API、資料庫、權限、後台、風控規則、佇列、監控、測試策略。

	•	Codex Spec：拆成可執行開發任務，包含驗收測試與資料種子。

**Rev D 結論**

Rev A 使商業與 CRM 框架工程可落地；Rev B 補齊財務、資安、合規四道防線；Rev C 加上高併發、防弊、頻控、法規公式鎖與事故治理的鋼盾層（含総付景品法條修正）；Rev D 完成收斂：折扣級距整併入 Tier 並保障既有權益、評分公式統一為單一真相、Tier 制度分階段啟用且參數全數可調、實作選型回歸 ADR。PRD 至此凍結為 v1.1 Final Rev D，不再新增產品功能，下一步進入 Architecture Review 與 SAD，將 Reward、Wallet、Notification、Compliance、QR Supply Chain、IP Asset Policy、Member Tier 與 Team Synergy 轉化為架構決策與技術設計。

*5min coffee Platform 2.0 PRD v1.1 Final Rev D*（*Frozen for Architecture Review*）｜整併 *Rev A/B/C* 並完成四項收斂補丁｜僅供內部規劃參考