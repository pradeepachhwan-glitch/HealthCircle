
export const doctorAvailability = pgTable("doctor_availability", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sun-Sat)
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "17:00"
  slotDuration: integer("slot_duration").default(30), // minutes
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  slotTime: timestamp("slot_time").notNull(),
  status: text("status").default("scheduled"), // scheduled, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});
