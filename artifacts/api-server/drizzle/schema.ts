import { pgTable, unique, serial, text, boolean, integer, timestamp, jsonb, index, varchar, foreignKey, numeric, uniqueIndex, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	clerkId: text("clerk_id").notNull(),
	displayName: text("display_name").notNull(),
	email: text().notNull(),
	username: text(),
	mobileNumber: text("mobile_number"),
	avatarUrl: text("avatar_url"),
	role: text().default('member').notNull(),
	accountType: text("account_type").default('personal').notNull(),
	isBanned: boolean("is_banned").default(false).notNull(),
	healthCredits: integer("health_credits").default(0).notNull(),
	weeklyCredits: integer("weekly_credits").default(0).notNull(),
	level: integer().default(1).notNull(),
	specialty: text(),
	registrationNumber: text("registration_number"),
	isVerifiedPro: boolean("is_verified_pro").default(false).notNull(),
	subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true, mode: 'string' }),
	passwordHash: text("password_hash"),
	emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: 'string' }),
	googleId: text("google_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	location: text(),
	personalHealthRecord: jsonb("personal_health_record"),
}, (table) => [
	unique("users_clerk_id_unique").on(table.clerkId),
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
	unique("users_mobile_number_unique").on(table.mobileNumber),
	unique("users_google_id_unique").on(table.googleId),
]);

export const emailOtps = pgTable("email_otps", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 320 }).notNull(),
	codeHash: varchar("code_hash", { length: 128 }).notNull(),
	purpose: varchar({ length: 20 }).default('login').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumed: boolean().default(false).notNull(),
	attempts: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("IDX_email_otps_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("IDX_email_otps_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const postUpvotes = pgTable("post_upvotes", {
	id: serial().primaryKey().notNull(),
	postId: integer("post_id").notNull(),
	userId: integer("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "post_upvotes_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "post_upvotes_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("post_upvotes_post_id_user_id_unique").on(table.postId, table.userId),
]);

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	communityId: integer("community_id").notNull(),
	authorId: integer("author_id").notNull(),
	title: text().notNull(),
	content: text().notNull(),
	imageUrl: text("image_url"),
	isPinned: boolean("is_pinned").default(false).notNull(),
	isBroadcast: boolean("is_broadcast").default(false).notNull(),
	isModerated: boolean("is_moderated").default(false).notNull(),
	isExpertAnswered: boolean("is_expert_answered").default(false).notNull(),
	upvoteCount: integer("upvote_count").default(0).notNull(),
	commentCount: integer("comment_count").default(0).notNull(),
	viewCount: integer("view_count").default(0).notNull(),
	contentType: text("content_type").default('discussion').notNull(),
	contentUrl: text("content_url"),
	contentSource: text("content_source"),
	contentThumbnail: text("content_thumbnail"),
	contentDurationSec: integer("content_duration_sec"),
	contentSummary: text("content_summary"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isAnonymous: boolean("is_anonymous").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.communityId],
			foreignColumns: [communities.id],
			name: "posts_community_id_communities_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "posts_author_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const achievements = pgTable("achievements", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	badgeName: text("badge_name").notNull(),
	badgeDescription: text("badge_description").notNull(),
	badgeIcon: text("badge_icon").notNull(),
	earnedAt: timestamp("earned_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "achievements_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const comments = pgTable("comments", {
	id: serial().primaryKey().notNull(),
	postId: integer("post_id").notNull(),
	authorId: integer("author_id").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isAnonymous: boolean("is_anonymous").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "comments_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "comments_author_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const healthChatSessions = pgTable("health_chat_sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	title: text().default('New Chat').notNull(),
	language: text().default('en').notNull(),
	communitySlug: text("community_slug"),
	communityName: text("community_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "health_chat_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const hospitals = pgTable("hospitals", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	location: text().notNull(),
	specialties: text().array().default([""]).notNull(),
	rating: numeric({ precision: 3, scale:  2 }).default('0').notNull(),
	phone: text(),
	email: text(),
	website: text(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const searchLogs = pgTable("search_logs", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	query: text().notNull(),
	intent: text(),
	riskLevel: text("risk_level"),
	clickedResult: text("clicked_result"),
	language: text().default('en').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "search_logs_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const providerRankings = pgTable("provider_rankings", {
	id: serial().primaryKey().notNull(),
	providerId: integer("provider_id").notNull(),
	providerType: text("provider_type").notNull(),
	boostScore: numeric("boost_score", { precision: 5, scale:  2 }).default('0').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
	id: serial().primaryKey().notNull(),
	patientId: integer("patient_id").notNull(),
	doctorId: integer("doctor_id"),
	hospitalId: integer("hospital_id"),
	appointmentTime: timestamp("appointment_time", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('booked').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [users.id],
			name: "appointments_patient_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "appointments_doctor_id_doctors_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "appointments_hospital_id_hospitals_id_fk"
		}).onDelete("set null"),
]);

export const doctors = pgTable("doctors", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	name: text().notNull(),
	specialty: text().notNull(),
	experienceYears: integer("experience_years").default(0).notNull(),
	consultationFee: numeric("consultation_fee", { precision: 10, scale:  2 }).default('0').notNull(),
	rating: numeric({ precision: 3, scale:  2 }).default('0').notNull(),
	location: text().default(').notNull(),
	bio: text(),
	languages: text().array().default(["en"]).notNull(),
	available: boolean().default(true).notNull(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "doctors_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const doctorConsultations = pgTable("doctor_consultations", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	postId: integer("post_id"),
	chatSessionId: integer("chat_session_id"),
	riskLevel: text("risk_level").default('high').notNull(),
	reason: text(),
	status: text().default('pending').notNull(),
	source: text().default('user_request').notNull(),
	doctorNote: text("doctor_note"),
	resolvedById: integer("resolved_by_id"),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "doctor_consultations_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "doctor_consultations_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatSessionId],
			foreignColumns: [healthChatSessions.id],
			name: "doctor_consultations_chat_session_id_health_chat_sessions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resolvedById],
			foreignColumns: [users.id],
			name: "doctor_consultations_resolved_by_id_users_id_fk"
		}),
]);

export const payments = pgTable("payments", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	communityId: integer("community_id"),
	provider: text().default('razorpay').notNull(),
	purpose: text().notNull(),
	amountInr: integer("amount_inr").notNull(),
	currency: text().default('INR').notNull(),
	status: text().default('created').notNull(),
	providerOrderId: text("provider_order_id").notNull(),
	providerPaymentId: text("provider_payment_id"),
	providerSignature: text("provider_signature"),
	notes: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payments_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.communityId],
			foreignColumns: [communities.id],
			name: "payments_community_id_communities_id_fk"
		}).onDelete("set null"),
	unique("payments_provider_order_id_unique").on(table.providerOrderId),
]);

export const apiUsage = pgTable("api_usage", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	dayKey: text("day_key").notNull(),
	count: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("api_usage_user_day_uq").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.dayKey.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_usage_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const tcConsultations = pgTable("tc_consultations", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	doctorId: integer("doctor_id"),
	triageSessionId: integer("triage_session_id"),
	type: text().default('video').notNull(),
	status: text().default('pending').notNull(),
	triageScore: text("triage_score"),
	chiefComplaint: text("chief_complaint"),
	consentGiven: text("consent_given").default('false'),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	consultationFee: numeric("consultation_fee", { precision: 10, scale:  2 }),
	notes: text(),
	diagnosis: text(),
	followUpInstructions: text("follow_up_instructions"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	googleEventId: text("google_event_id"),
	googleMeetUrl: text("google_meet_url"),
});

export const tcTriageSessions = pgTable("tc_triage_sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	chiefComplaint: text("chief_complaint").notNull(),
	symptomsJson: text("symptoms_json"),
	duration: text(),
	severity: integer(),
	medicalHistory: text("medical_history"),
	medications: text(),
	vitals: text(),
	riskLevel: text("risk_level"),
	summary: text(),
	suggestedSpecialty: text("suggested_specialty"),
	suggestedConsultType: text("suggested_consult_type"),
	rawAiResponse: text("raw_ai_response"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const tcPrescriptions = pgTable("tc_prescriptions", {
	id: serial().primaryKey().notNull(),
	consultationId: integer("consultation_id").notNull(),
	icdCodes: text("icd_codes"),
	medicationsJson: text("medications_json"),
	instructions: text(),
	followUpDate: text("follow_up_date"),
	redFlags: text("red_flags"),
	pdfUrl: text("pdf_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const aiSummaries = pgTable("ai_summaries", {
	id: serial().primaryKey().notNull(),
	postId: integer("post_id").notNull(),
	whatItCouldBe: text("what_it_could_be").notNull(),
	riskLevel: text("risk_level").default('low').notNull(),
	whatToDo: text("what_to_do").notNull(),
	whenToSeeDoctor: text("when_to_see_doctor").notNull(),
	disclaimer: text().notNull(),
	fullResponse: jsonb("full_response"),
	status: text().default('pending').notNull(),
	validatedById: integer("validated_by_id"),
	validatedAt: timestamp("validated_at", { withTimezone: true, mode: 'string' }),
	editedContent: text("edited_content"),
	validationNote: text("validation_note"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "ai_summaries_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.validatedById],
			foreignColumns: [users.id],
			name: "ai_summaries_validated_by_id_users_id_fk"
		}),
	unique("ai_summaries_post_id_unique").on(table.postId),
]);

export const tcMessages = pgTable("tc_messages", {
	id: serial().primaryKey().notNull(),
	consultationId: integer("consultation_id").notNull(),
	senderId: integer("sender_id").notNull(),
	senderRole: text("sender_role").default('patient').notNull(),
	message: text().notNull(),
	attachmentUrl: text("attachment_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const communities = pgTable("communities", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	iconEmoji: text("icon_emoji"),
	iconUrl: text("icon_url"),
	coverColor: text("cover_color"),
	isArchived: boolean("is_archived").default(false).notNull(),
	isPubliclyReadable: boolean("is_publicly_readable").default(false).notNull(),
	isPremium: boolean("is_premium").default(false).notNull(),
	premiumPriceInr: integer("premium_price_inr").default(0).notNull(),
	premiumPerks: text("premium_perks"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("communities_slug_unique").on(table.slug),
]);

export const communityMembers = pgTable("community_members", {
	id: serial().primaryKey().notNull(),
	communityId: integer("community_id").notNull(),
	userId: integer("user_id").notNull(),
	hasPremiumAccess: boolean("has_premium_access").default(false).notNull(),
	premiumPaymentId: text("premium_payment_id"),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.communityId],
			foreignColumns: [communities.id],
			name: "community_members_community_id_communities_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "community_members_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("community_members_community_id_user_id_unique").on(table.communityId, table.userId),
]);

export const healthChatMessages = pgTable("health_chat_messages", {
	id: serial().primaryKey().notNull(),
	sessionId: integer("session_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	intent: text(),
	structuredResponse: jsonb("structured_response"),
	attachmentUrl: text("attachment_url"),
	attachmentType: text("attachment_type"),
	attachmentName: text("attachment_name"),
	language: text().default('en').notNull(),
	verificationStatus: text("verification_status"),
	verifiedById: integer("verified_by_id"),
	verifiedByName: text("verified_by_name"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [healthChatSessions.id],
			name: "health_chat_messages_session_id_health_chat_sessions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.verifiedById],
			foreignColumns: [users.id],
			name: "health_chat_messages_verified_by_id_users_id_fk"
		}).onDelete("set null"),
]);

export const consents = pgTable("consents", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	consentType: text("consent_type").notNull(),
	accepted: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "consents_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const auditLog = pgTable("audit_log", {
	id: serial().primaryKey().notNull(),
	actorUserId: integer("actor_user_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	meta: jsonb(),
	ip: text(),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_log_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("audit_log_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("int4_ops")),
	index("audit_log_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "audit_log_actor_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const doctorApplications = pgTable("doctor_applications", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	name: text().notNull(),
	specialty: text().notNull(),
	registrationNumber: text("registration_number").notNull(),
	experienceYears: integer("experience_years").default(0).notNull(),
	location: text().default(').notNull(),
	languages: text().array().default(["en"]).notNull(),
	bio: text(),
	consultationFee: numeric("consultation_fee", { precision: 10, scale:  2 }).default('0').notNull(),
	status: text().default('pending').notNull(),
	reviewerUserId: integer("reviewer_user_id"),
	reviewerNotes: text("reviewer_notes"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("doctor_apps_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("doctor_apps_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("doctor_apps_user_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "doctor_applications_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewerUserId],
			foreignColumns: [users.id],
			name: "doctor_applications_reviewer_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	endpoint: text().notNull(),
	p256Dh: text().notNull(),
	auth: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "push_subscriptions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("push_subscriptions_endpoint_unique").on(table.endpoint),
]);

export const googleTokens = pgTable("google_tokens", {
	userId: integer("user_id").primaryKey().notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),
	googleEmail: text("google_email"),
	expiryDate: timestamp("expiry_date", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const hospitalSettings = pgTable("hospital_settings", {
	id: serial().primaryKey().notNull(),
	hospitalId: integer("hospital_id").notNull(),
	logoUrl: text("logo_url"),
	letterheadConfig: jsonb("letterhead_config").default({}),
	signatureBlockTemplate: text("signature_block_template"),
	googleWorkspaceConfig: jsonb("google_workspace_config").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_settings_hospital_id_hospitals_id_fk"
		}),
	unique("hospital_settings_hospital_id_unique").on(table.hospitalId),
]);

export const hospitalCareTeam = pgTable("hospital_care_team", {
	id: serial().primaryKey().notNull(),
	hospitalId: integer("hospital_id").notNull(),
	userId: integer("user_id").notNull(),
	role: text().default('doctor').notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	specialty: text(),
	signatureUrl: text("signature_url"),
	credentials: text(),
	registrationNumber: text("registration_number"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_care_team_hospital_id_hospitals_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "hospital_care_team_user_id_users_id_fk"
		}),
]);

export const hospitalConsultations = pgTable("hospital_consultations", {
	id: serial().primaryKey().notNull(),
	hospitalId: integer("hospital_id").notNull(),
	patientId: integer("patient_id").notNull(),
	doctorId: integer("doctor_id"),
	status: text().default('requested').notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
	googleEventId: text("google_event_id"),
	googleMeetUrl: text("google_meet_url"),
	intakeSummary: text("intake_summary"),
	transcript: text(),
	soapDraft: jsonb("soap_draft"),
	isApproved: boolean("is_approved").default(false).notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	clinicalNoteUrl: text("clinical_note_url"),
	signatureBlockUsed: text("signature_block_used"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_consultations_hospital_id_hospitals_id_fk"
		}),
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [users.id],
			name: "hospital_consultations_patient_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [users.id],
			name: "hospital_consultations_doctor_id_users_id_fk"
		}),
]);

export const postBookmarks = pgTable("post_bookmarks", {
	postId: integer("post_id").notNull(),
	userId: integer("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("post_bookmarks_post_idx").using("btree", table.postId.asc().nullsLast().op("int4_ops")),
	index("post_bookmarks_user_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "post_bookmarks_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "post_bookmarks_user_id_users_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.postId, table.userId], name: "post_bookmarks_post_id_user_id_pk"}),
]);

export const postReactions = pgTable("post_reactions", {
	postId: integer("post_id").notNull(),
	userId: integer("user_id").notNull(),
	emoji: varchar({ length: 16 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("post_reactions_post_emoji_idx").using("btree", table.postId.asc().nullsLast().op("text_ops"), table.emoji.asc().nullsLast().op("int4_ops")),
	index("post_reactions_post_idx").using("btree", table.postId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "post_reactions_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "post_reactions_user_id_users_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.postId, table.userId], name: "post_reactions_post_id_user_id_pk"}),
]);
