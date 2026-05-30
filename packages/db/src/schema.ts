import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  godotVersion: text("godot_version"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  imagePath: text("image_path").notNull(),
  model: text("model").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  filePath: text("file_path").notNull(),
  enabled: integer("enabled").notNull().default(0),
  category: text("category").notNull().default("general"),
  projectId: text("project_id"),
});

export const mcpConnections = sqliteTable("mcp_connections", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("disconnected"),
  lastConnected: integer("last_connected"),
  relayUrl: text("relay_url").notNull(),
});

export const providerCredentials = sqliteTable("provider_credentials", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().unique(),
  apiKey: text("api_key").notNull().default(""),
  enabled: integer("enabled").notNull().default(0),
  metadata: text("metadata").notNull().default("{}"),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
