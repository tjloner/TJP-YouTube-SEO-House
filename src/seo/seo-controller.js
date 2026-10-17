/**
 * TJP YouTube SEO Engine — Controller & Auth Bridge
 * Module: src/seo/seo-controller.ts
 *
 * Responsibilities:
 *  - User Authentication & Session Orchestration
 *  - 3-Day Default Trial Engine with Admin Extensibility
 *  - Member vs Demo vs Admin Tier Authorization
 *  - Admin Management Interface Contracts (User Approvals, Subscriptions, Overrides)
 *  - Secure Proxy Handshake between Client UI and Backend (tjpromotions.pro)
 */
import { TjpSeoEngine } from './seo-engine';
/* ==========================================================================
   2. CONTROLLER BRIDGE IMPLEMENTATION
   ========================================================================== */
const STORAGE_SESSION_KEY = 'tjp_seo_user_session';
const STORAGE_USER_DB_KEY = 'tjp_seo_mock_db_users';
const DEFAULT_TRIAL_DAYS = 3;
export class TjpSeoController {
    static config = {
        backendBaseUrl: 'https://tjpromotions.pro/api/seo',
        useRemoteBackend: false // Default to client-side mode for easy GitHub testing
    };
    /**
     * Configure controller environment (GitHub preview vs tjpromotions.pro production)
     */
    static setConfig(customConfig) {
        this.config = { ...this.config, ...customConfig };
    }
    /* --------------------------------------------------------------------------
       SESSION & AUTH MANAGEMENT
       -------------------------------------------------------------------------- */
    /**
     * Initializes or restores the user session.
     * If fresh user: creates a 3-day trial automatically.
     */
    static getOrCreateSession(email = 'creator@tjpromotions.pro', name = 'Demo Creator') {
        try {
            const stored = localStorage.getItem(STORAGE_SESSION_KEY);
            if (stored) {
                const session = JSON.parse(stored);
                return this.evaluateTrialHealth(session);
            }
        }
        catch {
            // Fallback if localStorage is disabled/blocked
        }
        // Default New User Profile (3-Day Trial Default)
        const newSession = {
            userId: 'usr_' + Math.random().toString(36).substring(2, 9),
            email,
            name,
            role: 'member',
            tier: 'trial',
            approvalStatus: 'approved', // Auto-approved for 3-day trial
            trialStartDate: Date.now(),
            trialDurationDays: DEFAULT_TRIAL_DAYS,
            queriesUsedToday: 0,
            maxDailyQueries: 10,
            lastQueryTimestamp: 0
        };
        this.saveSession(newSession);
        this.syncUserToMockDB(newSession);
        return newSession;
    }
    /**
     * Validates whether a user's 3-day trial is still valid or expired.
     */
    static evaluateTrialHealth(session) {
        if (session.tier === 'active_member' || session.role === 'admin') {
            return session; // Paying members or Admins are never constrained
        }
        const elapsedMs = Date.now() - session.trialStartDate;
        const allowedMs = session.trialDurationDays * 24 * 60 * 60 * 1000;
        if (elapsedMs > allowedMs) {
            session.tier = 'expired';
            this.saveSession(session);
            this.syncUserToMockDB(session);
        }
        return session;
    }
    /* --------------------------------------------------------------------------
       EXECUTION GATEWAY (Member vs Trial vs Expired)
       -------------------------------------------------------------------------- */
    /**
     * Primary entry point for `seo-workspace.html` to run queries safely.
     */
    static async executeAnalysis(input) {
        let session = this.getOrCreateSession();
        session = this.evaluateTrialHealth(session);
        // 1. Check Approval Gate
        if (session.approvalStatus === 'pending') {
            return {
                success: false,
                error: 'Your account is pending manual review by the administrator on tjpromotions.pro.',
                executionTimeMs: 0
            };
        }
        if (session.approvalStatus === 'rejected') {
            return {
                success: false,
                error: 'Access restricted. Please contact support at tjpromotions.pro.',
                executionTimeMs: 0
            };
        }
        // 2. Check Trial Expiration Gate
        if (session.tier === 'expired') {
            const daysRan = session.trialDurationDays;
            return {
                success: false,
                error: `Your ${daysRan}-Day Trial has ended. Upgrade your subscription on tjpromotions.pro to continue generating SEO strategies.`,
                executionTimeMs: 0
            };
        }
        // 3. Daily Rate Limit Checks
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - session.lastQueryTimestamp > oneDay) {
            session.queriesUsedToday = 0; // Reset quota daily
        }
        if (session.tier === 'trial' && session.queriesUsedToday >= session.maxDailyQueries) {
            return {
                success: false,
                error: `Daily trial quota reached (${session.maxDailyQueries}/${session.maxDailyQueries} queries). Resets in 24 hours or upgrade to Pro.`,
                executionTimeMs: 0
            };
        }
        // 4. Execution Pathway (Local Engine vs Remote Shared Hosting Bridge)
        if (this.config.useRemoteBackend) {
            return this.dispatchRemoteBackend(input, session);
        }
        else {
            // Local zero-cost execution
            const engineResult = TjpSeoEngine.analyze(input);
            if (engineResult.success) {
                session.queriesUsedToday += 1;
                session.lastQueryTimestamp = Date.now();
                this.saveSession(session);
                this.syncUserToMockDB(session);
            }
            return engineResult;
        }
    }
    /* --------------------------------------------------------------------------
       REMOTE BACKEND BRIDGE (tjpromotions.pro)
       -------------------------------------------------------------------------- */
    /**
     * Future-proofed dispatch to your shared hosting backend.
     * Kept ready for deployment when hosting is linked.
     */
    static async dispatchRemoteBackend(input, session) {
        const t0 = performance.now();
        try {
            const response = await fetch(`${this.config.backendBaseUrl}/query.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': session.userId,
                    'X-Session-Tier': session.tier
                },
                body: JSON.stringify(input)
            });
            if (!response.ok) {
                throw new Error(`Server returned status HTTP ${response.status}`);
            }
            const payload = await response.json();
            return payload;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Backend unreachable';
            return {
                success: false,
                error: `Remote API Bridge Error: ${message}. Falling back to zero-cost offline engine.`,
                executionTimeMs: performance.now() - t0
            };
        }
    }
    /* --------------------------------------------------------------------------
       ADMIN INTERFACE HOOKS (Ready for Admin Panel Development)
       -------------------------------------------------------------------------- */
    /**
     * Allows the Admin to view all active users and their remaining trial days.
     */
    static adminGetAllUsers() {
        try {
            const raw = localStorage.getItem(STORAGE_USER_DB_KEY);
            return raw ? JSON.parse(raw) : [this.getOrCreateSession()];
        }
        catch {
            return [this.getOrCreateSession()];
        }
    }
    /**
     * Allows Admin to modify trial duration, change tiers, or approve/block users.
     */
    static adminUpdateUser(payload) {
        const users = this.adminGetAllUsers();
        const index = users.findIndex(u => u.userId === payload.userId);
        if (index === -1)
            return false;
        if (payload.tier)
            users[index].tier = payload.tier;
        if (payload.approvalStatus)
            users[index].approvalStatus = payload.approvalStatus;
        if (payload.overrideTrialDays !== undefined) {
            users[index].trialDurationDays = payload.overrideTrialDays;
            // Reset start date if admin grants an extension
            users[index].trialStartDate = Date.now();
            if (users[index].tier === 'expired')
                users[index].tier = 'trial';
        }
        if (payload.maxDailyQueries !== undefined) {
            users[index].maxDailyQueries = payload.maxDailyQueries;
        }
        try {
            localStorage.setItem(STORAGE_USER_DB_KEY, JSON.stringify(users));
            // If updating current active user, sync active session too
            const current = this.getOrCreateSession();
            if (current.userId === payload.userId) {
                this.saveSession(users[index]);
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /* --------------------------------------------------------------------------
       INTERNAL PERSISTENCE HELPERS
       -------------------------------------------------------------------------- */
    static saveSession(session) {
        try {
            localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        }
        catch {
            // Safe fallback
        }
    }
    static syncUserToMockDB(session) {
        try {
            const users = this.adminGetAllUsers();
            const idx = users.findIndex(u => u.userId === session.userId);
            if (idx >= 0) {
                users[idx] = session;
            }
            else {
                users.push(session);
            }
            localStorage.setItem(STORAGE_USER_DB_KEY, JSON.stringify(users));
        }
        catch {
            // Safe fallback
        }
    }
}
