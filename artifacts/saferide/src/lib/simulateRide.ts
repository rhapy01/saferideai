/**
 * Simulated Makerere → Nakawa ride with intentional risk moments.
 * Speeds in km/h, accel in m/s².
 */
const SPEED_LIMIT = 50;

const PATH = [
  { lat: 0.3326, lng: 32.5705 },
  { lat: 0.3318, lng: 32.5752 },
  { lat: 0.3309, lng: 32.5808 },
  { lat: 0.3301, lng: 32.5865 },
  { lat: 0.3294, lng: 32.5922 },
  { lat: 0.3288, lng: 32.5978 },
  { lat: 0.3282, lng: 32.6035 },
  { lat: 0.3276, lng: 32.6090 },
  { lat: 0.3271, lng: 32.6142 },
  { lat: 0.3266, lng: 32.6195 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolatePath(points: { lat: number; lng: number }[], stepsPerSegment = 5) {
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      out.push({
        lat: lerp(points[i].lat, points[i + 1].lat, t),
        lng: lerp(points[i].lng, points[i + 1].lng, t),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const coords = interpolatePath(PATH, 5);

function profileAt(i: number, n: number) {
  const p = i / Math.max(n - 1, 1);
  let speed = 28 + Math.sin(p * Math.PI) * 18;
  let accelZ = -0.2 + Math.sin(i * 0.7) * 0.4;
  let lateral = Math.abs(Math.sin(i * 0.35)) * 0.8;

  if (p > 0.28 && p < 0.42) {
    speed = 62 + (i % 3);
  }
  if (i === Math.floor(n * 0.48)) {
    speed = 35;
    accelZ = -4.6;
  }
  if (i === Math.floor(n * 0.62)) {
    speed = 48;
    lateral = 4.2;
  }
  if (p > 0.78 && p < 0.88) {
    speed = 56;
  }
  if (p > 0.9) {
    speed = 32;
    accelZ = -0.3;
    lateral = 0.5;
  }

  return { speed, accelZ, lateralAccel: lateral, speedLimit: SPEED_LIMIT };
}

export type SimFrame = {
  lat: number;
  lng: number;
  speed: number;
  accelZ: number;
  lateralAccel: number;
  speedLimit: number;
  t: number;
};

export const SIM_RIDE = {
  id: "makerere-nakawa-demo",
  title: "Makerere → Nakawa (demo)",
  routeHint: "Makerere University area toward Nakawa, Kampala",
  speedLimit: SPEED_LIMIT,
  tickMs: 700,
  frames: coords.map((c, i): SimFrame => {
    const sens = profileAt(i, coords.length);
    return { ...c, ...sens, t: i * 0.7 };
  }),
};

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
