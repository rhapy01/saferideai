import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useGetRide, getAnalyzeRideUrl } from "@workspace/api-client-react";
import { Gauge } from "@/components/ui/gauge";
import { RideMap, type RiskPoint } from "@/components/ride-map";
import { scoreToGrade } from "@/lib/safety";
import { ArrowLeft, RefreshCw, Zap, Copy } from "lucide-react";

const TRACK_KEY = (id: number) => `saferide-track-${id}`;

function loadTrack(id: number): { lat: number; lng: number }[] {
  try {
    const raw = sessionStorage.getItem(TRACK_KEY(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { lat: number; lng: number }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PostRide() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { data: ride, isLoading, refetch } = useGetRide(id);

  const [report, setReport] = useState("");
  const [model, setModel] = useState("gemma-4-26b-a4b-it");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTrack, setSavedTrack] = useState<{ lat: number; lng: number }[]>([]);
  const analyzeStarted = useRef(false);

  const runAnalyze = async () => {
    if (!id || Number.isNaN(id)) return;
    setLoading(true);
    setError(null);
    setReport("");

    try {
      const res = await fetch(getAnalyzeRideUrl(id), { method: "POST" });
      // 504/502: gateway killed a slow AI call — refetch in case a prior report landed
      if (res.status === 504 || res.status === 502) {
        const refreshed = await refetch();
        const saved = refreshed.data?.aiReport;
        if (saved) {
          setReport(saved);
          return;
        }
        throw new Error("Analyze timed out — tap Retry (usually under 30s)");
      }
      if (!res.ok || !res.body) {
        throw new Error(`Analyze failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";
      let sawError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          try {
            const data = JSON.parse(json) as {
              content?: string;
              done?: boolean;
              error?: string;
              model?: string;
              status?: string;
            };
            if (data.model) setModel(data.model);
            if (data.error) sawError = data.error;
            if (data.content) {
              assembled += data.content;
              setReport(assembled);
            }
          } catch {
            /* ignore partial JSON */
          }
        }
      }

      if (sawError && !assembled) setError(sawError);
      if (!assembled && !sawError) await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemma report failed");
      analyzeStarted.current = false; // allow retry
    } finally {
      setLoading(false);
      void refetch();
    }
  };

  useEffect(() => {
    if (!Number.isNaN(id)) setSavedTrack(loadTrack(id));
  }, [id]);

  useEffect(() => {
    if (!ride) return;
    if (ride.aiReport) {
      setReport(ride.aiReport);
      return;
    }
    if (ride.endedAt && !analyzeStarted.current) {
      analyzeStarted.current = true;
      void runAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.id, ride?.aiReport, ride?.endedAt]);

  if (isLoading || !ride) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        Loading post-ride review…
      </div>
    );
  }

  const score = Math.round(ride.safetyScore ?? 0);
  const grade = scoreToGrade(score);
  const scoreColor =
    score >= 75 ? "text-primary" : score >= 50 ? "text-yellow-500" : "text-destructive";

  const riskPoints: RiskPoint[] =
    ride.events
      ?.filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        lat: e.lat!,
        lng: e.lng!,
        severity: e.severity,
        label: `${e.type.replaceAll("_", " ")}${e.speed != null ? ` @ ${e.speed.toFixed(0)} km/h` : ""}`,
      })) ?? [];

  const track =
    savedTrack.length > 1
      ? savedTrack
      : riskPoints.map((p) => ({ lat: p.lat, lng: p.lng }));

  const copyReport = async () => {
    const text = [
      `SafeRide AI — Grade ${grade} (${score}/100)`,
      report,
      `Powered by ${model}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-5 max-w-md mx-auto w-full pb-10">
      <header className="flex items-center justify-between pt-4">
        <Link href="/" className="text-muted-foreground hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Home
        </Link>
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Post-ride
        </span>
      </header>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Grade {grade}</p>
        <div className="flex justify-center">
          <Gauge value={score} size={180} strokeWidth={12} colorClass={scoreColor} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Distance</div>
          <div className="font-mono text-lg">{(ride.totalDistance ?? 0).toFixed(1)} km</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Max</div>
          <div className="font-mono text-lg">{Math.round(ride.maxSpeed ?? 0)} km/h</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Events</div>
          <div className="font-mono text-lg">{ride.events?.length ?? ride.eventCount ?? 0}</div>
        </div>
      </div>

      <section className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Gemma 4 safety coach</h2>
          <span className="text-[10px] font-mono text-primary truncate max-w-[140px]">{model}</span>
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground animate-pulse">Gemma is writing your report…</p>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => {
                analyzeStarted.current = true;
                void runAnalyze();
              }}
              className="text-sm flex items-center gap-1 text-primary"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}
        {!loading && !error && report && (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{report}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Route & risk heat</h2>
        <RideMap
          track={track}
          riskPoints={riskPoints}
          current={track[track.length - 1] ?? riskPoints[riskPoints.length - 1]}
          height={240}
          fitAll
        />
      </section>

      <section className="bg-card border border-card-border rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-sm">Event log</h2>
        {(ride.events?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No risk events on this ride.</p>
        ) : (
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {ride.events!.map((e) => (
              <li key={e.id} className="text-xs font-mono flex justify-between gap-2">
                <span
                  className={
                    e.severity === "high"
                      ? "text-destructive"
                      : e.severity === "medium"
                        ? "text-orange-400"
                        : "text-muted-foreground"
                  }
                >
                  {e.type.replaceAll("_", " ")}
                </span>
                <span className="text-muted-foreground">
                  {e.speed != null ? `${e.speed.toFixed(0)} km/h` : e.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Assistive coaching only — not medical, legal, or emergency advice. Sensors are rule-based;
        Simulate Ride is for reliable demos.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void copyReport()}
          disabled={!report}
          className="flex-1 bg-secondary border border-secondary-border py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1"
        >
          <Copy size={14} /> Copy
        </button>
        <button
          type="button"
          onClick={() => setLocation("/ride")}
          className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1"
        >
          <Zap size={14} /> Simulate again
        </button>
      </div>
    </div>
  );
}
