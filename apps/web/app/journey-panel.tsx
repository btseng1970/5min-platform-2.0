"use client";

import { useMemo, useState } from "react";
import { createApiClient } from "api-contract";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

interface JourneyPanelProps {
  campaignId: string;
}

interface ResultBlock {
  label: string;
  ok: boolean;
  body: unknown;
}

export function JourneyPanel({ campaignId }: JourneyPanelProps) {
  // Consumes the BFF only through packages/shared/api-contract's typed
  // client (GA-015) — never an independently shaped fetch() call.
  const client = useMemo(() => createApiClient(API_BASE_URL), []);

  const [correlationId, setCorrelationId] = useState<string>("");
  const [qrCode, setQrCode] = useState("SIGNED-DEMO-QR-TW-001");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [results, setResults] = useState<ResultBlock[]>([]);

  function pushResult(label: string, ok: boolean, body: unknown) {
    setResults((prev) => [{ label, ok, body }, ...prev]);
  }

  function startJourney() {
    const newCorrelationId = crypto.randomUUID();
    setCorrelationId(newCorrelationId);
    setIdempotencyKey(crypto.randomUUID());
    setResults([]);
    pushResult("Journey started", true, { correlation_id: newCorrelationId });
  }

  async function scanQr() {
    const result = await client.scanQr(
      { code: qrCode, client_request_id: crypto.randomUUID() },
      { correlationId },
    );
    pushResult("1. Scan QR", result.ok, result.body);
  }

  async function triggerDraw(reuseIdempotencyKey: boolean) {
    const key = reuseIdempotencyKey ? idempotencyKey : crypto.randomUUID();
    if (!reuseIdempotencyKey) setIdempotencyKey(key);
    const result = await client.createDraw(
      { campaign_id: campaignId, client_request_id: crypto.randomUUID() },
      key,
      { correlationId },
    );
    pushResult(reuseIdempotencyKey ? "2b. Replay same draw (idempotent)" : "2. Trigger draw", result.ok, result.body);
  }

  async function refreshMemberCenter() {
    const result = await client.getMemberCenter({ correlationId });
    pushResult("3. Member center", result.ok, result.body);
  }

  async function viewTrace() {
    const result = await client.getAdminAuditLog(correlationId);
    pushResult("4. Correlation trace", result.ok, result.body);
  }

  return (
    <section>
      <h2>Demo journey</h2>
      <p>
        <button onClick={startJourney}>Start new journey (new correlation_id)</button>
      </p>
      {correlationId && (
        <>
          <p>correlation_id: {correlationId}</p>
          <p>
            QR code:{" "}
            <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} size={30} />{" "}
            <button onClick={scanQr}>1. Scan QR</button>
          </p>
          <p>
            <button onClick={() => triggerDraw(false)}>2. Trigger draw</button>{" "}
            <button onClick={() => triggerDraw(true)} disabled={!idempotencyKey}>
              2b. Replay same draw (idempotent)
            </button>
          </p>
          <p>
            <button onClick={refreshMemberCenter}>3. Refresh member center</button>
          </p>
          <p>
            <button onClick={viewTrace}>4. View correlation trace</button>
          </p>
        </>
      )}
      <div>
        {results.map((result, index) => (
          <div key={index}>
            <strong>
              {result.label} — {result.ok ? "OK" : "ERROR"}
            </strong>
            <pre>{JSON.stringify(result.body, null, 2)}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
