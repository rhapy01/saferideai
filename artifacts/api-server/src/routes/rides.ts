import { Router, type IRouter } from "express";
import { eq, desc, avg, sum, count, max } from "drizzle-orm";
import { db, ridesTable, rideEventsTable } from "@workspace/db";
import {
  CreateRideBody,
  UpdateRideBody as UpdateRideBodySchema,
  CreateRideEventBody,
  GetRideParams,
  UpdateRideParams,
  DeleteRideParams,
  ListRideEventsParams,
  CreateRideEventParams,
  AnalyzeRideParams,
} from "@workspace/api-zod";
import { getAi, GEMMA_MODEL } from "@workspace/integrations-gemini-ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /rides
router.get("/rides", async (_req, res): Promise<void> => {
  const rides = await db
    .select()
    .from(ridesTable)
    .orderBy(desc(ridesTable.createdAt));
  res.json(rides);
});

// POST /rides
router.post("/rides", async (req, res): Promise<void> => {
  const parsed = CreateRideBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [ride] = await db
    .insert(ridesTable)
    .values({ mode: parsed.data.mode })
    .returning();
  res.status(201).json(ride);
});

// GET /rides/stats
router.get("/rides/stats", async (_req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalRides: count(ridesTable.id),
      avgSafetyScore: avg(ridesTable.safetyScore),
      totalDistance: sum(ridesTable.totalDistance),
      totalEvents: sum(ridesTable.eventCount),
      bestScore: max(ridesTable.safetyScore),
    })
    .from(ridesTable);

  const recentRides = await db
    .select({ safetyScore: ridesTable.safetyScore })
    .from(ridesTable)
    .where(eq(ridesTable.mode, "real"))
    .orderBy(desc(ridesTable.createdAt))
    .limit(6);

  let recentTrend: "improving" | "declining" | "stable" = "stable";
  if (recentRides.length >= 4) {
    const scores = recentRides.map((r) => r.safetyScore ?? 0);
    const firstHalf = scores.slice(scores.length / 2).reduce((a, b) => a + b, 0) / (scores.length / 2);
    const secondHalf = scores.slice(0, scores.length / 2).reduce((a, b) => a + b, 0) / (scores.length / 2);
    if (secondHalf > firstHalf + 3) recentTrend = "improving";
    else if (secondHalf < firstHalf - 3) recentTrend = "declining";
  }

  res.json({
    totalRides: Number(stats.totalRides) ?? 0,
    avgSafetyScore: stats.avgSafetyScore ? Number(stats.avgSafetyScore) : null,
    totalDistance: stats.totalDistance ? Number(stats.totalDistance) : null,
    totalEvents: stats.totalEvents ? Number(stats.totalEvents) : 0,
    bestScore: stats.bestScore ? Number(stats.bestScore) : null,
    recentTrend,
  });
});

// GET /rides/:id
router.get("/rides/:id", async (req, res): Promise<void> => {
  const params = GetRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [ride] = await db
    .select()
    .from(ridesTable)
    .where(eq(ridesTable.id, params.data.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  const events = await db
    .select()
    .from(rideEventsTable)
    .where(eq(rideEventsTable.rideId, params.data.id))
    .orderBy(rideEventsTable.timestamp);
  res.json({ ...ride, events });
});

// PATCH /rides/:id
router.patch("/rides/:id", async (req, res): Promise<void> => {
  const params = UpdateRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRideBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.endedAt !== undefined) updateData.endedAt = new Date(parsed.data.endedAt);
  if (parsed.data.safetyScore !== undefined) updateData.safetyScore = parsed.data.safetyScore;
  if (parsed.data.maxSpeed !== undefined) updateData.maxSpeed = parsed.data.maxSpeed;
  if (parsed.data.totalDistance !== undefined) updateData.totalDistance = parsed.data.totalDistance;
  if (parsed.data.aiReport !== undefined) updateData.aiReport = parsed.data.aiReport;

  const [ride] = await db
    .update(ridesTable)
    .set(updateData)
    .where(eq(ridesTable.id, params.data.id))
    .returning();
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  res.json(ride);
});

// DELETE /rides/:id
router.delete("/rides/:id", async (req, res): Promise<void> => {
  const params = DeleteRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [ride] = await db
    .delete(ridesTable)
    .where(eq(ridesTable.id, params.data.id))
    .returning();
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /rides/:id/events
router.get("/rides/:id/events", async (req, res): Promise<void> => {
  const params = ListRideEventsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const events = await db
    .select()
    .from(rideEventsTable)
    .where(eq(rideEventsTable.rideId, params.data.id))
    .orderBy(rideEventsTable.timestamp);
  res.json(events);
});

// POST /rides/:id/events
router.post("/rides/:id/events", async (req, res): Promise<void> => {
  const params = CreateRideEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateRideEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db
    .insert(rideEventsTable)
    .values({ rideId: params.data.id, ...parsed.data })
    .returning();

  const [{ value: eventCount }] = await db
    .select({ value: count() })
    .from(rideEventsTable)
    .where(eq(rideEventsTable.rideId, params.data.id));

  await db
    .update(ridesTable)
    .set({ eventCount: Number(eventCount) })
    .where(eq(ridesTable.id, params.data.id));

  res.status(201).json(event);
});

// POST /rides/:id/analyze — Gemma 4 safety coach (SSE; non-stream generate + retry)
router.post("/rides/:id/analyze", async (req, res): Promise<void> => {
  const params = AnalyzeRideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ride] = await db
    .select()
    .from(ridesTable)
    .where(eq(ridesTable.id, params.data.id));
  if (!ride) {
    res.status(404).json({ error: "Ride not found" });
    return;
  }

  const events = await db
    .select()
    .from(rideEventsTable)
    .where(eq(rideEventsTable.rideId, params.data.id))
    .orderBy(rideEventsTable.timestamp);

  const eventSummary =
    events
      .map(
        (e) =>
          `- ${e.type.replaceAll("_", " ")} (${e.severity})${e.speed != null ? ` at ${e.speed.toFixed(0)} km/h` : ""}${e.lat != null && e.lng != null ? ` near ${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : ""}`,
      )
      .join("\n") || "No risky events detected.";

  const durationMin =
    ride.endedAt && ride.startedAt
      ? Math.round(
          (new Date(ride.endedAt).getTime() -
            new Date(ride.startedAt).getTime()) /
            60000,
        )
      : "?";

  const prompt = `You are an experienced, friendly motorcycle/scooter (boda-boda) safety coach for Kampala riders.

Ride data:
- Route context: Makerere University area toward Nakawa, Kampala
- Safety score: ${ride.safetyScore?.toFixed(0) ?? "N/A"}/100
- Duration: ${durationMin} minutes
- Distance: ${ride.totalDistance?.toFixed(2) ?? "?"} km
- Max speed: ${ride.maxSpeed?.toFixed(0) ?? "?"} km/h (typical urban limit ~50 km/h)
- Events:
${eventSummary}

Write a short encouraging report (max 120 words):
1. Overall assessment
2. The 1-2 most important issues (if any)
3. 1-2 specific actionable tips for Kampala roads

Tone: supportive but direct. Do not invent events. No markdown headers.`;

  const shortPrompt = `Boda safety coach for Kampala. Score ${ride.safetyScore?.toFixed(0) ?? "?"}/100. Max ${ride.maxSpeed?.toFixed(0) ?? "?"} km/h. Events: ${events.map((e) => e.type).join(", ") || "none"}. Write 80 words: assessment + 2 tips. No markdown.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const model = GEMMA_MODEL;
  let fullReport = "";

  try {
    const ai = getAi();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Minimal request — hosted Gemma is picky; keep contents as plain string.
        const response = await ai.models.generateContent({
          model,
          contents: attempt <= 3 ? prompt : shortPrompt,
        });
        fullReport = (response.text || "").trim();
        if (fullReport) break;
        lastErr = new Error("Empty response from Gemma");
      } catch (err) {
        lastErr = err;
        logger.warn({ err, attempt, model }, "Gemma generate attempt failed");
        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }

    if (!fullReport) {
      throw lastErr ?? new Error("Gemma returned empty report");
    }

    res.write(`data: ${JSON.stringify({ content: fullReport, model })}\n\n`);

    await db
      .update(ridesTable)
      .set({ aiReport: fullReport })
      .where(eq(ridesTable.id, params.data.id));

    res.write(`data: ${JSON.stringify({ done: true, model })}\n\n`);
  } catch (err) {
    logger.error({ err, model }, "Gemma analyze error");
    const message =
      err instanceof Error ? err.message : "AI analysis failed";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.end();
});

export default router;
