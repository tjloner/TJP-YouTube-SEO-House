import { TjpSeoEngine } from './seo-engine.js';

const STORAGE_SESSION_KEY = 'tjp_seo_user_session';
const STORAGE_USER_DB_KEY = 'tjp_seo_mock_db_users';
const DEFAULT_TRIAL_DAYS = 3;

export class TjpSeoController {
  static config = {
    backendBaseUrl: 'https://tjpromotions.pro/api/seo',
    useRemoteBackend: false
  };

  static setConfig(customConfig) {
    this.config = { ...this.config, ...customConfig };
  }

  static getOrCreateSession(email = 'creator@tjpromotions.pro', name = 'Demo Creator') {
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        return this.evaluateTrialHealth(session);
      }
    } catch (e) {}

    const newSession = {
      userId: 'usr_' + Math.random().toString(36).substring(2, 9),
      email,
      name,
      role: 'member',
      tier: 'trial',
      approvalStatus: 'approved',
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

  static evaluateTrialHealth(session) {
    if (session.tier === 'active_member' || session.role === 'admin') {
      return session;
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

  static async executeAnalysis(input) {
    let session = this.getOrCreateSession();
    session = this.evaluateTrialHealth(session);

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

    if (session.tier === 'expired') {
      return {
        success: false,
        error: `Your ${session.trialDurationDays}-Day Trial has ended. Upgrade your subscription on tjpromotions.pro to continue.`,
        executionTimeMs: 0
      };
    }

    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - session.lastQueryTimestamp > oneDay) {
      session.queriesUsedToday = 0;
    }

    if (session.tier === 'trial' && session.queriesUsedToday >= session.maxDailyQueries) {
      return {
        success: false,
        error: `Daily trial quota reached (${session.maxDailyQueries}/${session.maxDailyQueries} queries). Resets in 24 hours or upgrade to Pro.`,
        executionTimeMs: 0
      };
    }

    const engineResult = TjpSeoEngine.analyze(input);

    if (engineResult.success) {
      session.queriesUsedToday += 1;
      session.lastQueryTimestamp = Date.now();
      this.saveSession(session);
      this.syncUserToMockDB(session);
    }

    return engineResult;
  }

  static adminGetAllUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USER_DB_KEY);
      return raw ? JSON.parse(raw) : [this.getOrCreateSession()];
    } catch {
      return [this.getOrCreateSession()];
    }
  }

  static adminUpdateUser(payload) {
    const users = this.adminGetAllUsers();
    const index = users.findIndex(u => u.userId === payload.userId);
    if (index === -1) return false;

    if (payload.tier) users[index].tier = payload.tier;
    if (payload.approvalStatus) users[index].approvalStatus = payload.approvalStatus;
    if (payload.overrideTrialDays !== undefined) {
      users[index].trialDurationDays = payload.overrideTrialDays;
      users[index].trialStartDate = Date.now();
      if (users[index].tier === 'expired') users[index].tier = 'trial';
    }
    if (payload.maxDailyQueries !== undefined) {
      users[index].maxDailyQueries = payload.maxDailyQueries;
    }

    try {
      localStorage.setItem(STORAGE_USER_DB_KEY, JSON.stringify(users));
      const current = this.getOrCreateSession();
      if (current.userId === payload.userId) {
        this.saveSession(users[index]);
      }
      return true;
    } catch {
      return false;
    }
  }

  static saveSession(session) {
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch (e) {}
  }

  static syncUserToMockDB(session) {
    try {
      const users = this.adminGetAllUsers();
      const idx = users.findIndex(u => u.userId === session.userId);
      if (idx >= 0) {
        users[idx] = session;
      } else {
        users.push(session);
      }
      localStorage.setItem(STORAGE_USER_DB_KEY, JSON.stringify(users));
    } catch (e) {}
  }
}
