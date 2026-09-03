'use strict';

const { getHealthBuildIdentity } = require('../lib/buildIdentity');

describe('getHealthBuildIdentity', () => {
  test('prefers RENDER_GIT_COMMIT over other git/build stamps', () => {
    expect(getHealthBuildIdentity({
      RENDER_GIT_COMMIT: 'abc123def456',
      GIT_SHA: 'git-sha-should-lose',
      SOURCE_VERSION: 'source-version-should-lose',
      BUILD_ID: 'build-id-should-lose',
    })).toBe('abc123def456');
  });

  test('falls back to GIT_SHA, then SOURCE_VERSION, then BUILD_ID', () => {
    expect(getHealthBuildIdentity({
      GIT_SHA: 'from-git-sha',
      SOURCE_VERSION: 'from-source-version',
      BUILD_ID: 'from-build-id',
    })).toBe('from-git-sha');

    expect(getHealthBuildIdentity({
      SOURCE_VERSION: 'from-source-version',
      BUILD_ID: 'from-build-id',
    })).toBe('from-source-version');

    expect(getHealthBuildIdentity({
      BUILD_ID: 'local-dev-stamp',
    })).toBe('local-dev-stamp');
  });

  test('skips empty/whitespace values and never returns a hardcoded date', () => {
    expect(getHealthBuildIdentity({
      RENDER_GIT_COMMIT: '  ',
      GIT_SHA: '',
      BUILD_ID: '  fallback-id  ',
    })).toBe('fallback-id');

    expect(getHealthBuildIdentity({})).toBe('unknown');
    expect(getHealthBuildIdentity({})).not.toMatch(/20\d{2}-\d{2}-\d{2}/);
  });
});
