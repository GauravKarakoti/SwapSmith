import { relations } from "drizzle-orm/relations";
import { users, courseProgress, rewardsLog } from "./schema";

export const courseProgressRelations = relations(courseProgress, ({one}) => ({
	user: one(users, {
		fields: [courseProgress.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	courseProgresses: many(courseProgress),
	rewardsLogs: many(rewardsLog),
}));

export const rewardsLogRelations = relations(rewardsLog, ({one}) => ({
	user: one(users, {
		fields: [rewardsLog.userId],
		references: [users.id]
	}),
}));