import { pgTable, serial, text, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ridesTable = pgTable("rides", {
  id: serial("id").primaryKey(),
  mode: text("mode", { enum: ["real", "simulate"] }).notNull().default("real"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  safetyScore: real("safety_score"),
  maxSpeed: real("max_speed"),
  totalDistance: real("total_distance"),
  eventCount: integer("event_count").notNull().default(0),
  aiReport: text("ai_report"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof ridesTable.$inferSelect;

export const rideEventsTable = pgTable("ride_events", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => ridesTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["speeding", "harsh_braking", "sharp_turn"] }).notNull(),
  severity: text("severity", { enum: ["low", "medium", "high"] }).notNull(),
  lat: real("lat"),
  lng: real("lng"),
  speed: real("speed"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertRideEventSchema = createInsertSchema(rideEventsTable).omit({ id: true });
export type InsertRideEvent = z.infer<typeof insertRideEventSchema>;
export type RideEvent = typeof rideEventsTable.$inferSelect;
