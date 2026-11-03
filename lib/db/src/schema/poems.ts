import { pgTable, text, serial, boolean, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const poemsTable = pgTable("poems", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleUrdu: text("title_urdu").notNull(),
  content: text("content").notNull(),
  poetName: text("poet_name").notNull(),
  poetNameUrdu: text("poet_name_urdu").notNull(),
  category: text("category").notNull(),
  categoryUrdu: text("category_urdu").notNull(),
  featured: boolean("featured").notNull().default(false),
  imageUrl: text("image_url"),
  likes: integer("likes").notNull().default(0),
  views: integer("views").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  visualPoetry: boolean("visual_poetry").notNull().default(false),
  language: text("language").notNull().default("urdu"),
  // Contributor approval workflow
  status: text("status", { enum: ["published", "pending", "rejected", "draft"] }).notNull().default("published"),
  createdByUserId: integer("created_by_user_id"),
  approvedByUserId: integer("approved_by_user_id"),
  approvedAt: timestamp("approved_at"),
  rejectedByUserId: integer("rejected_by_user_id"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// insertPoemSchema: server controls all workflow/attribution fields
export const insertPoemSchema = createInsertSchema(poemsTable).omit({
  id: true, createdAt: true, updatedAt: true, likes: true, views: true, shares: true,
  status: true, createdByUserId: true,
  approvedByUserId: true, approvedAt: true,
  rejectedByUserId: true, rejectedAt: true, rejectionReason: true,
});
export type InsertPoem = z.infer<typeof insertPoemSchema>;
export type Poem = typeof poemsTable.$inferSelect;

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameUrdu: text("name_urdu").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;

export const poetsTable = pgTable("poets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameUrdu: text("name_urdu").notNull(),
  bio: text("bio").notNull(),
  bioUrdu: text("bio_urdu").notNull(),
  era: text("era").notNull(),
});

export const insertPoetSchema = createInsertSchema(poetsTable).omit({ id: true });
export type InsertPoet = z.infer<typeof insertPoetSchema>;
export type Poet = typeof poetsTable.$inferSelect;

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleUrdu: text("title_urdu").notNull(),
  description: text("description").notNull(),
  youtubeId: text("youtube_id").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration").notNull(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  poemId: integer("poem_id").references(() => poemsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;

export const contactMessagesTable = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessagesTable).omit({ id: true, createdAt: true });
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessagesTable.$inferSelect;

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
});

export type Setting = typeof settingsTable.$inferSelect;

export const backupsTable = pgTable("backups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Backup = typeof backupsTable.$inferSelect;

export const usersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["developer", "admin", "contributor"] }).notNull().default("admin"),
  name: text("name").notNull().default(""),
  // Account lifecycle
  status: text("status", { enum: ["active", "disabled", "activation_pending"] }).notNull().default("active"),
  lastLoginAt: timestamp("last_login_at"),
  notes: text("notes"),
  activationPendingAt: timestamp("activation_pending_at", { withTimezone: true }),
  // Used for instant session invalidation when account is disabled or password is reset
  tokenRevokedAt: timestamp("token_revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminUser = typeof usersTable.$inferSelect;

export const contributorApplicationsTable = pgTable("contributor_applications", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  dateOfBirth: date("date_of_birth"),
  contactInformation: text("contact_information"),
  bio: text("bio").notNull(),
  contributionArea: text("contribution_area").notNull(),
  preferredLanguage: text("preferred_language").notNull(),
  category: text("category").notNull(),
  portfolio: text("portfolio"),
  termsVersion: text("terms_version").notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  activationTokenHash: text("activation_token_hash"),
  activationTokenCiphertext: text("activation_token_ciphertext"),
  activationExpiresAt: timestamp("activation_expires_at", { withTimezone: true }),
  activationUsedAt: timestamp("activation_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContributorApplication = typeof contributorApplicationsTable.$inferSelect;

export const toolsTable = pgTable("tools", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleUrdu: text("title_urdu").notNull(),
  description: text("description").notNull().default(""),
  descriptionUrdu: text("description_urdu").notNull().default(""),
  url: text("url").notNull(),
  active: boolean("active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Tool = typeof toolsTable.$inferSelect;

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
