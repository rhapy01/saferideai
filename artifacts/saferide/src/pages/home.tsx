import { useGetRideStats, getGetRideStatsQueryKey, useListRides, getListRidesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Gauge, Activity, History, ArrowRight, ShieldAlert, Navigation2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetRideStats();
  const { data: rides, isLoading: ridesLoading } = useListRides();

  const recentRides = rides?.slice(0, 3) || [];

  return (
    <div className="flex-1 flex flex-col p-4 space-y-8 max-w-md mx-auto w-full pb-24">
      <header className="pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">SafeRide <span className="text-primary">HUD</span></h1>
        <p className="text-muted-foreground text-sm">Your AI safety companion.</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 bg-card border border-card-border p-5 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldAlert size={80} />
          </div>
          <p className="text-sm text-muted-foreground mb-1 font-medium tracking-wide uppercase">Avg Safety Score</p>
          <div className="text-5xl font-mono font-bold text-primary tracking-tighter">
            {statsLoading ? "--" : Math.round(stats?.avgSafetyScore || 0)}
          </div>
        </div>
        
        <div className="bg-card border border-card-border p-4 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Rides</p>
          <div className="text-2xl font-mono text-white">
            {statsLoading ? "--" : stats?.totalRides || 0}
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Distance (km)</p>
          <div className="text-2xl font-mono text-white">
            {statsLoading ? "--" : Math.round(stats?.totalDistance || 0)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent Logs</h2>
          <Link href="/history" className="text-sm text-primary flex items-center hover:underline">
            View All <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>

        <div className="space-y-3">
          {ridesLoading ? (
            <div className="h-20 bg-card rounded-xl animate-pulse"></div>
          ) : recentRides.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-xl border border-card-border">
              <p className="text-muted-foreground">No rides logged yet.</p>
            </div>
          ) : (
            recentRides.map(ride => (
              <Link key={ride.id} href={`/rides/${ride.id}`} className="block">
                <div className="bg-card border border-card-border hover:border-primary/50 transition-colors p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {formatDistanceToNow(new Date(ride.createdAt), { addSuffix: true })}
                    </div>
                    <div className="font-mono text-lg text-white">
                      {ride.totalDistance ? ride.totalDistance.toFixed(1) : "0"} km
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-mono text-2xl font-bold ${
                      (ride.safetyScore || 0) >= 75 ? 'text-primary' : 
                      (ride.safetyScore || 0) >= 50 ? 'text-yellow-500' : 'text-destructive'
                    }`}>
                      {ride.safetyScore || '--'}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase">Score</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto z-50">
        <Link href="/ride" className="w-full">
          <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-xl font-bold text-lg flex items-center justify-center shadow-[0_0_20px_rgba(22,163,74,0.3)] transition-all active:scale-[0.98]">
            <Navigation2 className="mr-2" />
            SIMULATE / START RIDE
          </button>
        </Link>
      </div>
    </div>
  );
}