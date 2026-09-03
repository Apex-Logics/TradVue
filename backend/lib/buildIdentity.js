'use strict';

/**
 * Identity string for GET /health `build`.
 *
 * Precedence (first non-empty wins):
 *   1. RENDER_GIT_COMMIT — Render injects this on every deploy
 *   2. GIT_SHA           — common CI / Docker build-arg name
 *   3. SOURCE_VERSION    — Heroku and some PaaS hosts
 *   4. BUILD_ID          — operator-supplied fallback for local/dev or hosts
 *                          that do not inject a git SHA. Set this env var to a
 *                          short stamp (e.g. a truncated SHA or a date+label).
 *                          Never hardcode a date in source; that goes stale
 *                          the moment the next deploy lands.
 * If none are set, returns 'unknown' so the payload never claims a past build.
 */
function getHealthBuildIdentity(env = process.env) {
  const candidates = [
    env.RENDER_GIT_COMMIT,
    env.GIT_SHA,
    env.SOURCE_VERSION,
    env.BUILD_ID,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return 'unknown';
}

module.exports = { getHealthBuildIdentity };
