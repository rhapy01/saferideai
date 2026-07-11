const base = process.env.API_BASE || "http://127.0.0.1:8787";

async function main() {
  const health = await fetch(`${base}/api/healthz`).then((r) => r.json());
  console.log("health", health);

  const ride = await fetch(`${base}/api/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "simulate" }),
  }).then((r) => r.json());
  console.log("ride", ride.id);

  await fetch(`${base}/api/rides/${ride.id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "speeding",
      severity: "high",
      speed: 62,
      lat: 0.331,
      lng: 32.58,
    }),
  });

  await fetch(`${base}/api/rides/${ride.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endedAt: new Date().toISOString(),
      safetyScore: 72,
      maxSpeed: 62,
      totalDistance: 4.1,
    }),
  });

  const analyzeRes = await fetch(`${base}/api/rides/${ride.id}/analyze`, {
    method: "POST",
  });
  const text = await analyzeRes.text();
  console.log("analyze", text.slice(0, 500));

  const full = await fetch(`${base}/api/rides/${ride.id}`).then((r) => r.json());
  const ok =
    health.status === "ok" &&
    !!full.aiReport &&
    full.aiReport.length > 40 &&
    (full.events?.length || 0) >= 1;

  console.log(
    JSON.stringify({
      ok,
      score: full.safetyScore,
      events: full.events?.length,
      reportPreview: (full.aiReport || "").slice(0, 120),
    }),
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
