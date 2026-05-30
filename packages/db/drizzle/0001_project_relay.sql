CREATE TABLE `mcp_connections_new` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`last_connected` integer,
	`relay_url` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `mcp_connections_new` (`id`, `project_id`, `status`, `last_connected`, `relay_url`)
SELECT
	`id`,
	`project_id`,
	`status`,
	`last_connected`,
	'ws://127.0.0.1:6505/ws/' || `project_id`
FROM `mcp_connections`;
--> statement-breakpoint
DROP TABLE `mcp_connections`;
--> statement-breakpoint
ALTER TABLE `mcp_connections_new` RENAME TO `mcp_connections`;
