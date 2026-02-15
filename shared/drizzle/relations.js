"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardsLogRelations = exports.usersRelations = exports.courseProgressRelations = void 0;
const relations_1 = require("drizzle-orm/relations");
const schema_1 = require("./schema");
exports.courseProgressRelations = (0, relations_1.relations)(schema_1.courseProgress, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.courseProgress.userId],
        references: [schema_1.users.id]
    }),
}));
exports.usersRelations = (0, relations_1.relations)(schema_1.users, ({ many }) => ({
    courseProgresses: many(schema_1.courseProgress),
    rewardsLogs: many(schema_1.rewardsLog),
}));
exports.rewardsLogRelations = (0, relations_1.relations)(schema_1.rewardsLog, ({ one }) => ({
    user: one(schema_1.users, {
        fields: [schema_1.rewardsLog.userId],
        references: [schema_1.users.id]
    }),
}));
