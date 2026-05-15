import { relations } from "drizzle-orm/relations";
import { posts, postUpvotes, users, communities, achievements, comments, conversations, messages, healthChatSessions, searchLogs, appointments, doctors, hospitals, doctorConsultations, payments, apiUsage, aiSummaries, communityMembers, healthChatMessages, consents, auditLog, doctorApplications, pushSubscriptions, hospitalSettings, hospitalCareTeam, hospitalConsultations, postBookmarks, postReactions } from "./schema";

export const postUpvotesRelations = relations(postUpvotes, ({one}) => ({
	post: one(posts, {
		fields: [postUpvotes.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [postUpvotes.userId],
		references: [users.id]
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	postUpvotes: many(postUpvotes),
	community: one(communities, {
		fields: [posts.communityId],
		references: [communities.id]
	}),
	user: one(users, {
		fields: [posts.authorId],
		references: [users.id]
	}),
	comments: many(comments),
	doctorConsultations: many(doctorConsultations),
	aiSummaries: many(aiSummaries),
	postBookmarks: many(postBookmarks),
	postReactions: many(postReactions),
}));

export const usersRelations = relations(users, ({many}) => ({
	postUpvotes: many(postUpvotes),
	posts: many(posts),
	achievements: many(achievements),
	comments: many(comments),
	healthChatSessions: many(healthChatSessions),
	searchLogs: many(searchLogs),
	appointments: many(appointments),
	doctors: many(doctors),
	doctorConsultations_userId: many(doctorConsultations, {
		relationName: "doctorConsultations_userId_users_id"
	}),
	doctorConsultations_resolvedById: many(doctorConsultations, {
		relationName: "doctorConsultations_resolvedById_users_id"
	}),
	payments: many(payments),
	apiUsages: many(apiUsage),
	aiSummaries: many(aiSummaries),
	communityMembers: many(communityMembers),
	healthChatMessages: many(healthChatMessages),
	consents: many(consents),
	auditLogs: many(auditLog),
	doctorApplications_userId: many(doctorApplications, {
		relationName: "doctorApplications_userId_users_id"
	}),
	doctorApplications_reviewerUserId: many(doctorApplications, {
		relationName: "doctorApplications_reviewerUserId_users_id"
	}),
	pushSubscriptions: many(pushSubscriptions),
	hospitalCareTeams: many(hospitalCareTeam),
	hospitalConsultations_patientId: many(hospitalConsultations, {
		relationName: "hospitalConsultations_patientId_users_id"
	}),
	hospitalConsultations_doctorId: many(hospitalConsultations, {
		relationName: "hospitalConsultations_doctorId_users_id"
	}),
	postBookmarks: many(postBookmarks),
	postReactions: many(postReactions),
}));

export const communitiesRelations = relations(communities, ({many}) => ({
	posts: many(posts),
	payments: many(payments),
	communityMembers: many(communityMembers),
}));

export const achievementsRelations = relations(achievements, ({one}) => ({
	user: one(users, {
		fields: [achievements.userId],
		references: [users.id]
	}),
}));

export const commentsRelations = relations(comments, ({one}) => ({
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [comments.authorId],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({many}) => ({
	messages: many(messages),
}));

export const healthChatSessionsRelations = relations(healthChatSessions, ({one, many}) => ({
	user: one(users, {
		fields: [healthChatSessions.userId],
		references: [users.id]
	}),
	doctorConsultations: many(doctorConsultations),
	healthChatMessages: many(healthChatMessages),
}));

export const searchLogsRelations = relations(searchLogs, ({one}) => ({
	user: one(users, {
		fields: [searchLogs.userId],
		references: [users.id]
	}),
}));

export const appointmentsRelations = relations(appointments, ({one}) => ({
	user: one(users, {
		fields: [appointments.patientId],
		references: [users.id]
	}),
	doctor: one(doctors, {
		fields: [appointments.doctorId],
		references: [doctors.id]
	}),
	hospital: one(hospitals, {
		fields: [appointments.hospitalId],
		references: [hospitals.id]
	}),
}));

export const doctorsRelations = relations(doctors, ({one, many}) => ({
	appointments: many(appointments),
	user: one(users, {
		fields: [doctors.userId],
		references: [users.id]
	}),
}));

export const hospitalsRelations = relations(hospitals, ({many}) => ({
	appointments: many(appointments),
	hospitalSettings: many(hospitalSettings),
	hospitalCareTeams: many(hospitalCareTeam),
	hospitalConsultations: many(hospitalConsultations),
}));

export const doctorConsultationsRelations = relations(doctorConsultations, ({one}) => ({
	user_userId: one(users, {
		fields: [doctorConsultations.userId],
		references: [users.id],
		relationName: "doctorConsultations_userId_users_id"
	}),
	post: one(posts, {
		fields: [doctorConsultations.postId],
		references: [posts.id]
	}),
	healthChatSession: one(healthChatSessions, {
		fields: [doctorConsultations.chatSessionId],
		references: [healthChatSessions.id]
	}),
	user_resolvedById: one(users, {
		fields: [doctorConsultations.resolvedById],
		references: [users.id],
		relationName: "doctorConsultations_resolvedById_users_id"
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	user: one(users, {
		fields: [payments.userId],
		references: [users.id]
	}),
	community: one(communities, {
		fields: [payments.communityId],
		references: [communities.id]
	}),
}));

export const apiUsageRelations = relations(apiUsage, ({one}) => ({
	user: one(users, {
		fields: [apiUsage.userId],
		references: [users.id]
	}),
}));

export const aiSummariesRelations = relations(aiSummaries, ({one}) => ({
	post: one(posts, {
		fields: [aiSummaries.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [aiSummaries.validatedById],
		references: [users.id]
	}),
}));

export const communityMembersRelations = relations(communityMembers, ({one}) => ({
	community: one(communities, {
		fields: [communityMembers.communityId],
		references: [communities.id]
	}),
	user: one(users, {
		fields: [communityMembers.userId],
		references: [users.id]
	}),
}));

export const healthChatMessagesRelations = relations(healthChatMessages, ({one}) => ({
	healthChatSession: one(healthChatSessions, {
		fields: [healthChatMessages.sessionId],
		references: [healthChatSessions.id]
	}),
	user: one(users, {
		fields: [healthChatMessages.verifiedById],
		references: [users.id]
	}),
}));

export const consentsRelations = relations(consents, ({one}) => ({
	user: one(users, {
		fields: [consents.userId],
		references: [users.id]
	}),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
	user: one(users, {
		fields: [auditLog.actorUserId],
		references: [users.id]
	}),
}));

export const doctorApplicationsRelations = relations(doctorApplications, ({one}) => ({
	user_userId: one(users, {
		fields: [doctorApplications.userId],
		references: [users.id],
		relationName: "doctorApplications_userId_users_id"
	}),
	user_reviewerUserId: one(users, {
		fields: [doctorApplications.reviewerUserId],
		references: [users.id],
		relationName: "doctorApplications_reviewerUserId_users_id"
	}),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({one}) => ({
	user: one(users, {
		fields: [pushSubscriptions.userId],
		references: [users.id]
	}),
}));

export const hospitalSettingsRelations = relations(hospitalSettings, ({one}) => ({
	hospital: one(hospitals, {
		fields: [hospitalSettings.hospitalId],
		references: [hospitals.id]
	}),
}));

export const hospitalCareTeamRelations = relations(hospitalCareTeam, ({one}) => ({
	hospital: one(hospitals, {
		fields: [hospitalCareTeam.hospitalId],
		references: [hospitals.id]
	}),
	user: one(users, {
		fields: [hospitalCareTeam.userId],
		references: [users.id]
	}),
}));

export const hospitalConsultationsRelations = relations(hospitalConsultations, ({one}) => ({
	hospital: one(hospitals, {
		fields: [hospitalConsultations.hospitalId],
		references: [hospitals.id]
	}),
	user_patientId: one(users, {
		fields: [hospitalConsultations.patientId],
		references: [users.id],
		relationName: "hospitalConsultations_patientId_users_id"
	}),
	user_doctorId: one(users, {
		fields: [hospitalConsultations.doctorId],
		references: [users.id],
		relationName: "hospitalConsultations_doctorId_users_id"
	}),
}));

export const postBookmarksRelations = relations(postBookmarks, ({one}) => ({
	post: one(posts, {
		fields: [postBookmarks.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [postBookmarks.userId],
		references: [users.id]
	}),
}));

export const postReactionsRelations = relations(postReactions, ({one}) => ({
	post: one(posts, {
		fields: [postReactions.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [postReactions.userId],
		references: [users.id]
	}),
}));