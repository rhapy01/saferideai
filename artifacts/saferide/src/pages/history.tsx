import { Link } from "wouter";
import { useListRides } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";

export default function History() {
  const { data: rides, isLoading } = useListRides();

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full pb-10">
      <header className="pt-4 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Ride history</h1>
      </header>

      <div className="space-y-3">
        {isLoading ? (
          <div className="h-20 bg-card rounded-xl animate-pulse" />
        ) : !rides?.length ? (
          <div className="text-center p-8 bg-card rounded-xl border border-card-border text-muted-foreground">
            No rides yet. Run a Simulate Ride first.
          </div>
        ) : (
          rides.map((ride) => (
            <Link key={ride.id} href={`/rides/${ride.id}`} className="block">
              <div className="bg-card border border-card-border hover:border-primary/50 transition-colors p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {formatDistanceToNow(new Date(ride.createdAt), { addSuffix: true })}
                    {" · "}
                    {ride.mode}
                  </div>
                  <div className="font-mono text-lg text-white">
                    {ride.totalDistance ? ride.totalDistance.toFixed(1) : "0"} km
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`font-mono text-2xl font-bold ${
                      (ride.safetyScore || 0) >= 75
                        ? "text-primary"
                        : (ride.safetyScore || 0) >= 50
                          ? "text-yellow-500"
                          : "text-destructive"
                    }`}
                  >
                    {ride.safetyScore ?? "--"}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">Score</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
