import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateRide, useCreateRideEvent, useUpdateRide } from "@workspace/api-client-react";
import { Gauge } from "@/components/ui/gauge";
import { RideMap, type RiskPoint } from "@/components/ride-map";
import { useToast } from "@/hooks/use-toast";
import { SIM_RIDE } from "@/lib/simulateRide";
import { calculateScoreDelta, haversineKm } from "@/lib/safety";
import { Play, Square, Activity, Gauge as GaugeIcon, MapPin, Zap } from "lucide-react";

type LocalEvent = RiskPoint & {
  type: string;
  detail: string;
};

export default function ActiveRide() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createRide = useCreateRide();
  const createEvent = useCreateRideEvent();
  const updateRide = useUpdateRide();

  const [isActive, setIsActive] = useState(false);
  const [rideId, setRideId] = useState<number | null>(null);
  const [mode, setMode] = useState<"real" | "simulate" | null>(null);

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [safetyScore, setSafetyScore] = useState(100);
  const [distance, setDistance] = useState(0);
  const [track, setTrack] = useState<{ lat: number; lng: number }[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);

  const simulateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const scoreRef = useRef(100);
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const frameRef = useRef(0);
  const rideIdRef = useRef<number | null>(null);

  const finishingRef = useRef(false);

  const finishRide = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    if (simulateIntervalRef.current) {
      clearInterval(simulateIntervalRef.current);
      simulateIntervalRef.current = null;
    }
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }

    setIsActive(false);
    const id = rideIdRef.current;
    if (!id) {
      finishingRef.current = false;
      return;
    }

    try {
      await updateRide.mutateAsync({
        id,
        data: {
          endedAt: new Date().toISOString(),
          safetyScore: Math.round(scoreRef.current),
          maxSpeed: maxSpeedRef.current,
          totalDistance: distanceRef.current,
        },
      });
      setLocation(`/rides/${id}`);
    } catch {
      finishingRef.current = false;
      toast({ title: "Error saving ride", variant: "destructive" });
    }
  };

  const startSimulate = async () => {
    try {
      const ride = await createRide.mutateAsync({ data: { mode: "simulate" } });
      finishingRef.current = false;
      rideIdRef.current = ride.id;
      setRideId(ride.id);
      setMode("simulate");
      setIsActive(true);
      scoreRef.current = 100;
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      frameRef.current = 0;
      setSafetyScore(100);
      setDistance(0);
      setMaxSpeed(0);
      setCurrentSpeed(0);
      setTrack([]);
      setEvents([]);
      setFrameIdx(0);

      const frames = SIM_RIDE.frames;
      simulateIntervalRef.current = setInterval(() => {
        const i = frameRef.current;
        if (i >= frames.length) {
          void finishRide();
          return;
        }

        const frame = frames[i];
        const prev = i > 0 ? frames[i - 1] : null;
        if (prev) {
          distanceRef.current += haversineKm(prev, frame);
          setDistance(distanceRef.current);
        }

        setCurrentSpeed(Math.round(frame.speed));
        maxSpeedRef.current = Math.max(maxSpeedRef.current, frame.speed);
        setMaxSpeed(maxSpeedRef.current);
        setTrack((t) => [...t, { lat: frame.lat, lng: frame.lng }]);
        setFrameIdx(i);

        const { delta, events: detected } = calculateScoreDelta({
          currentSpeed: frame.speed,
          speedLimit: frame.speedLimit,
          accelZ: frame.accelZ,
          lateralAccel: frame.lateralAccel,
        });

        if (delta !== 0) {
          scoreRef.current = Math.max(0, Math.min(100, scoreRef.current + delta));
          setSafetyScore(scoreRef.current);
        }

        for (const ev of detected) {
          const local: LocalEvent = {
            lat: frame.lat,
            lng: frame.lng,
            severity: ev.severity,
            label: `${ev.type.replaceAll("_", " ")} — ${ev.detail}`,
            type: ev.type,
            detail: ev.detail,
          };
          setEvents((prev) => [...prev, local]);
          createEvent.mutate({
            id: ride.id,
            data: {
              type: ev.type,
              severity: ev.severity,
              speed: frame.speed,
              lat: frame.lat,
              lng: frame.lng,
            },
          });
          toast({
            title: ev.type.replaceAll("_", " ").toUpperCase(),
            description: ev.detail,
            variant: "destructive",
            duration: 2500,
          });
        }

        frameRef.current = i + 1;
      }, SIM_RIDE.tickMs);
    } catch {
      toast({ title: "Error starting simulation", variant: "destructive" });
    }
  };

  const startReal = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Falling back to simulation.",
        variant: "destructive",
      });
      startSimulate();
      return;
    }

    try {
      const ride = await createRide.mutateAsync({ data: { mode: "real" } });
      finishingRef.current = false;
      rideIdRef.current = ride.id;
      setRideId(ride.id);
      setMode("real");
      setIsActive(true);
      scoreRef.current = 100;
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      setSafetyScore(100);
      setDistance(0);
      setMaxSpeed(0);
      setCurrentSpeed(0);
      setTrack([]);
      setEvents([]);

      geoWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const speedMpS = pos.coords.speed || 0;
          const speedKmH = speedMpS * 3.6;
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };

          setCurrentSpeed(Math.round(speedKmH));
          maxSpeedRef.current = Math.max(maxSpeedRef.current, speedKmH);
          setMaxSpeed(maxSpeedRef.current);
          setTrack((t) => [...t, point]);

          if (lastLocationRef.current) {
            const d = haversineKm(lastLocationRef.current, point);
            if (d > 0 && d < 1) {
              distanceRef.current += d;
              setDistance(distanceRef.current);
            }
          }
          lastLocationRef.current = { ...point, timestamp: pos.timestamp };

          const { delta, events: detected } = calculateScoreDelta({
            currentSpeed: speedKmH,
            speedLimit: 50,
            accelZ: 0,
            lateralAccel: 0,
          });

          if (delta !== 0) {
            scoreRef.current = Math.max(0, Math.min(100, scoreRef.current + delta));
            setSafetyScore(scoreRef.current);
          }

          for (const ev of detected) {
            setEvents((prev) => [
              ...prev,
              {
                ...point,
                severity: ev.severity,
                label: `${ev.type} — ${ev.detail}`,
                type: ev.type,
                detail: ev.detail,
              },
            ]);
            createEvent.mutate({
              id: ride.id,
              data: {
                type: ev.type,
                severity: ev.severity,
                speed: speedKmH,
                lat: point.lat,
                lng: point.lng,
              },
            });
            toast({ title: "Risk detected", description: ev.detail, variant: "destructive" });
          }
        },
        (err) => console.warn(err),
        { enableHighAccuracy: true },
      );
    } catch {
      toast({ title: "Error starting ride", variant: "destructive" });
    }
  };

  useEffect(() => {
    return () => {
      if (simulateIntervalRef.current) clearInterval(simulateIntervalRef.current);
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current);
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-primary";
    if (score >= 50) return "text-yellow-500";
    return "text-destructive";
  };

  const current = track[track.length - 1] ?? null;
  const progress =
    mode === "simulate" && SIM_RIDE.frames.length
      ? Math.round((frameIdx / SIM_RIDE.frames.length) * 100)
      : null;

  if (!isActive) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-[100dvh]">
        <Activity size={64} className="text-muted-foreground mb-6 opacity-20" />
        <h1 className="text-3xl font-bold mb-2">Ready to Ride</h1>
        <p className="text-muted-foreground text-sm mb-8 max-w-xs">
          Demo judges: use Simulate Ride — Makerere → Nakawa with live score, events & map.
        </p>
        <div className="space-y-4 w-full max-w-sm">
          <button
            onClick={startSimulate}
            disabled={createRide.isPending}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg flex items-center justify-center shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:scale-[1.02] transition-transform"
          >
            <Zap className="mr-2" /> SIMULATE RIDE
          </button>
          <button
            onClick={startReal}
            className="w-full bg-secondary text-secondary-foreground py-4 rounded-xl font-bold text-lg border border-secondary-border flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <Play className="mr-2 fill-current" /> START REAL RIDE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 min-h-[100dvh] max-w-md mx-auto w-full gap-4 pb-8">
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
            {mode === "simulate" ? "Makerere → Nakawa" : "Recording"}
          </span>
        </div>
        {progress != null && (
          <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
        )}
      </div>

      <div className="flex justify-center">
        <Gauge
          value={safetyScore}
          size={200}
          strokeWidth={14}
          colorClass={getScoreColor(safetyScore)}
          className="drop-shadow-[0_0_15px_currentColor]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-card-border p-3 rounded-xl flex flex-col items-center">
          <GaugeIcon className="text-muted-foreground mb-1" size={18} />
          <div className="text-3xl font-mono font-bold text-white">{Math.round(currentSpeed)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">KM/H</div>
        </div>
        <div className="bg-card border border-card-border p-3 rounded-xl flex flex-col items-center">
          <MapPin className="text-muted-foreground mb-1" size={18} />
          <div className="text-3xl font-mono font-bold text-white">{distance.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">KM</div>
        </div>
      </div>

      <RideMap track={track} riskPoints={events} current={current} height={200} />

      {events.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-3 max-h-28 overflow-y-auto space-y-1">
          {events
            .slice()
            .reverse()
            .slice(0, 5)
            .map((e, i) => (
              <div key={`${e.lat}-${e.lng}-${i}`} className="text-xs font-mono flex justify-between gap-2">
                <span className={e.severity === "high" ? "text-destructive" : "text-orange-400"}>
                  {e.type.replaceAll("_", " ")}
                </span>
                <span className="text-muted-foreground truncate">{e.detail}</span>
              </div>
            ))}
        </div>
      )}

      <button
        onClick={() => void finishRide()}
        disabled={updateRide.isPending || !rideId}
        className="w-full mt-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground py-4 rounded-xl font-bold text-lg flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all active:scale-[0.98]"
      >
        <Square className="mr-2 fill-current" /> STOP RIDE
      </button>
    </div>
  );
}
