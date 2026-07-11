/** Rule-based safety scoring for demo reliability */

export type SafetyEventType = "speeding" | "harsh_braking" | "sharp_turn";

export type DetectedEvent = {
  type: SafetyEventType;
  severity: "low" | "medium" | "high";
  detail: string;
};

export function calculateScoreDelta({
  currentSpeed,
  speedLimit,
  accelZ,
  lateralAccel,
}: {
  currentSpeed: number;
  speedLimit: number;
  accelZ: number;
  lateralAccel: number;
}) {
  let delta = 0;
  const events: DetectedEvent[] = [];

  if (currentSpeed > speedLimit * 1.2) {
    delta -= 8;
    events.push({
      type: "speeding",
      severity: "high",
      detail: `+${Math.round(currentSpeed - speedLimit)} km/h over ${speedLimit}`,
    });
  } else if (currentSpeed > speedLimit * 1.1) {
    delta -= 4;
    events.push({
      type: "speeding",
      severity: "medium",
      detail: `+${Math.round(currentSpeed - speedLimit)} km/h over ${speedLimit}`,
    });
  }

  if (accelZ < -4.0) {
    delta -= 10;
    events.push({
      type: "harsh_braking",
      severity: "high",
      detail: `Decel ${accelZ.toFixed(1)} m/s²`,
    });
  } else if (accelZ < -2.5) {
    delta -= 5;
    events.push({
      type: "harsh_braking",
      severity: "medium",
      detail: `Decel ${accelZ.toFixed(1)} m/s²`,
    });
  }

  if (lateralAccel > 3.5 && currentSpeed > 40) {
    delta -= 7;
    events.push({
      type: "sharp_turn",
      severity: "high",
      detail: `Lateral ${lateralAccel.toFixed(1)} m/s² at ${Math.round(currentSpeed)} km/h`,
    });
  } else if (lateralAccel > 2.8 && currentSpeed > 30) {
    delta -= 3;
    events.push({
      type: "sharp_turn",
      severity: "medium",
      detail: `Lateral ${lateralAccel.toFixed(1)} m/s²`,
    });
  }

  if (events.length === 0 && currentSpeed > 5 && currentSpeed <= speedLimit) {
    delta += 0.6;
  }

  return { delta, events };
}

export function scoreToGrade(score: number) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
