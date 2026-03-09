# Release Process & Version Management

TradVue follows **Semantic Versioning 2.0.0** with a structured release workflow designed for rapid beta iteration and stability at 1.0.0.

---

## Table of Contents

1. [Semantic Versioning](#semantic-versioning)
2. [Release Cadence](#release-cadence)
3. [Version Bumping Rules](#version-bumping-rules)
4. [Beta Versioning Scheme](#beta-versioning-scheme)
5. [Release Workflow](#release-workflow)
6. [Tagging Strategy](#tagging-strategy)
7. [Commit Conventions](#commit-conventions)
8. [Public Changelog Page](#public-changelog-page)
9. [Release Checklist](#release-checklist)

---

## Semantic Versioning

TradVue uses **MAJOR.MINOR.PATCH** format: `X.Y.Z`

### Version Components

| Component | Bumped When | Example |
|-----------|-------------|---------|
| **MAJOR** | Breaking changes, architectural redesigns, incompatible API changes | `1.0.0` → `2.0.0` |
| **MINOR** | New backward-compatible features, new endpoints, feature additions | `0.1.0` → `0.2.0` |
| **PATCH** | Bug fixes, security patches, performance improvements | `0.1.0` → `0.1.1` |

### Pre-Release Versions

Pre-release versions are suffixed with a label and optional number:

- **Beta**: `0.1.0-beta`, `0.1.0-beta.1`, `0.1.0-beta.2`
- **Release Candidate (RC)**: `0.1.0-rc.1`, `0.1.0-rc.2`
- **Development**: `0.1.0-dev` (internal use only)

**Precedence Rule**: `0.1.0-beta < 0.1.0-rc.1 < 0.1.0`

---

## Release Cadence

### Beta Phase (v0.x.x)
- **Duration**: Until feature-complete (estimated 2-3 months)
- **Release Frequency**: Every 1-2 weeks
- **Breaking Changes**: Allowed (document in CHANGELOG)
- **User Base**: Early adopters and internal testing
- **Feedback**: Rapid iteration based on user feedback

### Stable Release (v1.0.0+)
- **Duration**: Ongoing maintenance
- **Release Frequency**: Every 2-4 weeks for features, hotfixes as needed
- **Breaking Changes**: Only in MAJOR version bumps
- **User Base**: Production users and paying customers
- **Support**: LTS branches for critical security issues

### Patch Release Hotfixes
- **Frequency**: On-demand for critical bugs or security issues
- **Timeline**: Within 24-48 hours of discovery
- **Branch**: Create `hotfix/` branch from release tag
- **Example**: `0.1.3` released for critical security fix in `0.1.2`

---

## Version Bumping Rules

### When to Bump MAJOR
- ❌ Data structure incompatibility (old users can't read new data)
- ❌ API endpoint removal or signature change
- ❌ Database schema breaking migration
- ❌ Complete feature redesign that breaks workflows
- ✅ Example: Changing `/api/watchlist/:id` to `/api/v2/portfolios/:id`

### When to Bump MINOR
- ✅ New features or endpoints
- ✅ New UI components or pages
- ✅ New external service integrations
- ✅ Performance improvements (backward compatible)
- ✅ Database schema additions (additive only)
- ✅ Example: Adding `/api/alerts/history` endpoint

### When to Bump PATCH
- ✅ Bug fixes without feature changes
- ✅ Security patches
- ✅ UI/UX improvements (non-structural)
- ✅ Dependency updates (security-related)
- ✅ Documentation updates
- ✅ Example: Fixing watchlist sync timing bug

### Zero-Version Rule (0.x.x)
During beta (v0.x.x), use this approach:

| Change Type | Bump | Example |
|-------------|------|---------|
| Breaking change | MINOR | `0.1.0` → `0.2.0` |
| New feature | MINOR or PATCH | `0.1.0` → `0.1.1` or `0.2.0` |
| Bug fix | PATCH | `0.1.0` → `0.1.1` |

**Rationale**: In beta, MAJOR is always 0, so we use MINOR for breaking changes to signal stability is not guaranteed.

---

## Beta Versioning Scheme

### Progression Example: From Beta to Stable

```
0.1.0-beta         ← Initial beta release
  ↓
0.1.0-beta.1       ← Bug fix during beta
0.1.0-beta.2       ← Additional features added
0.1.0-beta.3       ← User feedback incorporated
  ↓
0.1.0-rc.1         ← Release Candidate (feature-frozen)
0.1.0-rc.2         ← Final bug fixes before release
  ↓
0.1.0               ← Stable release (production-ready)
```

### Beta Rules

1. **Feature Freeze**: No new features after `-rc.1`
2. **Bug Fixes Only**: RC versions only include critical bug fixes
3. **Announce Breaking Changes**: If moving from `-beta` to next `-beta`, document breaking changes
4. **Public Communication**: Beta users should opt-in to updates
5. **Feedback Loop**: Use beta releases to validate API design before 1.0.0

### Example Timeline

| Date | Version | Status | Action |
|------|---------|--------|--------|
| Mar 6 | 0.1.0-beta | Released | Onboarding, watchlist, alerts shipped |
| Mar 13 | 0.1.1-beta | Released | Mobile bug fixes, watchlist improvements |
| Mar 20 | 0.1.2-beta | Released | News feed optimization, new indicators |
| Mar 27 | 0.2.0-beta | Released | Social sentiment feature added |
| Apr 3 | 0.2.0-rc.1 | Released | Feature freeze, RC testing begins |
| Apr 10 | 0.2.0-rc.2 | Released | Final bug fixes |
| Apr 17 | 1.0.0 | Released | **Feature-complete, production stable** |

---

## Release Workflow

### Step 1: Prepare Release Branch
```bash
# Create release branch (for MINOR/MAJOR, skip for PATCH)
git checkout -b release/0.2.0-beta

# Or for hotfix (PATCH)
git checkout -b hotfix/0.1.1 main
```

### Step 2: Update Files
```bash
# 1. Update CHANGELOG.md with new entries
# 2. Update version in package.json
# 3. Update version in docs/RELEASE_PROCESS.md (this file)
# 4. Update version in frontend/package.json if monorepo

VERSION="0.2.0-beta"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/g" package.json
```

### Step 3: Commit Release Changes
```bash
# Follow conventional commits
git commit -m "chore(release): bump version to $VERSION

- Update CHANGELOG.md with $VERSION changes
- Update package.json version
- Ready for release testing"

# Include commit link in CHANGELOG.md
```

### Step 4: Create Release Tag
```bash
# Create annotated tag (preferred)
git tag -a v0.2.0-beta -m "TradVue v0.2.0-beta - Social Sentiment Features"

# Or lightweight tag (for simple releases)
git tag v0.2.0-beta
```

### Step 5: Push to Repository
```bash
# Push branch and tag
git push origin release/0.2.0-beta
git push origin v0.2.0-beta

# For main/develop merges
git checkout main
git merge --no-ff release/0.2.0-beta
git push origin main
```

### Step 6: Deploy & Announce
- Deploy to staging, run smoke tests
- Deploy to production
- Create GitHub Release with CHANGELOG excerpt
- Announce on social media / email

---

## Tagging Strategy

### Tag Format

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<METADATA>]
```

### Examples

```
v0.1.0-beta          ← Initial beta
v0.1.0-beta.1        ← Beta iteration
v0.1.0-rc.1          ← Release candidate
v0.1.0               ← Stable release
v0.1.1               ← Patch release
v1.0.0               ← Major stable release
v1.0.1+build.123     ← Build metadata (optional)
```

### Tag Rules

1. **Always use `v` prefix**: `v0.1.0` (not `0.1.0`)
2. **Annotated tags for releases**: `git tag -a v0.1.0 -m "message"`
3. **One tag per release**: Don't retag unless critical error
4. **Link to CHANGELOG**: Tag message should reference CHANGELOG entry
5. **Delete and recreate** if mistake found (rare):
   ```bash
   git tag -d v0.1.0
   git push origin :refs/tags/v0.1.0
   git tag -a v0.1.0 -m "message"
   git push origin v0.1.0
   ```

---

## Commit Conventions

TradVue uses **Conventional Commits** format for clear changelog generation.

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Purpose | CHANGELOG | Version Bump |
|------|---------|-----------|--------------|
| `feat` | New feature | Added | MINOR |
| `fix` | Bug fix | Fixed | PATCH |
| `docs` | Documentation | — | — |
| `style` | Code style (no logic change) | — | — |
| `refactor` | Code refactor (no logic change) | Changed | — |
| `perf` | Performance improvement | Changed | PATCH |
| `test` | Test additions | — | — |
| `chore` | Maintenance, deps | — | — |
| `ci` | CI/CD changes | — | — |
| `security` | Security fix | Security | PATCH |

### Examples

```bash
# New feature
git commit -m "feat(watchlist): add drag-and-drop reordering

- Implement draggable watchlist items
- Save order to localStorage
- Show visual feedback during drag"

# Bug fix
git commit -m "fix(alerts): correct timezone offset in alert times"

# Breaking change (beta only)
git commit -m "feat(api)!: restructure news endpoint response

BREAKING CHANGE: /api/news now returns object with pagination
instead of array. Old format: [news]. New format: {items: [news], total, page}"

# Security fix
git commit -m "security: sanitize user input in search fields"
```

### Breaking Changes
For **beta versions only**, prefix commit with `!`:
```bash
git commit -m "feat(api)!: change watchlist response format"
```

---

## Public Changelog Page

### Spec for `/changelog` Route

**Responsibility**: Bolt (frontend engineer) to implement

### URL & Route
- **Route**: `GET /changelog`
- **Component**: `/pages/changelog.tsx` or `/app/changelog/page.tsx`
- **Layout**: Consistent with main app (header, footer, navigation)

### Content Display

#### 1. Header Section
```
TradVue Changelog
Version releases and updates

[Current Version Badge: v0.1.0-beta]
[Subscribe to Updates button]
```

#### 2. Version List (Chronological, newest first)
For each version:
```
┌─────────────────────────────────────────┐
│ Version: v0.2.0-beta                    │
│ Released: March 13, 2026                │
│ Status: Beta [Blue badge]               │
│ 📥 [Download Release Notes] [JSON API]  │
└─────────────────────────────────────────┘

### Added
- Real-time market alerts
- Watchlist sync across devices
- Dark mode UI

### Fixed
- Mobile responsive issues
- Watchlist persistence bug

### Security
- Privacy-first GA4 consent

[View Full Changelog Entry →]
```

#### 3. Expandable Sections
- Click "Added" header to expand/collapse that section
- Smooth animations for expand/collapse
- Preserve scroll position when expanding

### Features

#### Search & Filter
```
[Search versions...] 
Filter by: [All ▼] [Features] [Fixes] [Security] [Beta/Stable]
```

#### Engagement Elements
- **Subscribe Button**: "Get notified about updates" → Email signup
- **Share Button**: Share specific version to Twitter/LinkedIn
- **Roadmap Link**: Link to `/roadmap` for upcoming features
- **Feedback CTA**: "Found an issue? Report it →"

### Design Requirements

- **Responsive**: Mobile, tablet, desktop
- **Accessible**: WCAG 2.1 AA compliant
- **Fast**: Load first 5 versions, lazy-load on scroll
- **Themeable**: Respect dark mode preference
- **Printable**: CSS for print version

### Data Structure (Backend)

**Endpoint**: `GET /api/changelog` or static file `/data/changelog.json`

```json
{
  "versions": [
    {
      "version": "0.1.0-beta",
      "releasedAt": "2026-03-06T22:34:00Z",
      "status": "beta",
      "commitHash": "c19742f",
      "sections": {
        "added": ["Feature 1", "Feature 2"],
        "changed": ["Change 1"],
        "fixed": ["Fix 1"],
        "security": ["Security improvement"],
        "removed": []
      },
      "downloads": {
        "notes": "/releases/v0.1.0-beta/RELEASE_NOTES.md",
        "changelog": "/CHANGELOG.md"
      }
    }
  ],
  "currentVersion": "0.1.0-beta"
}
```

### Implementation Priority

1. **MVP (Week 1)**:
   - Display versions chronologically
   - Parse CHANGELOG.md into sections
   - Basic search

2. **Phase 2 (Week 2)**:
   - Expandable sections
   - Filter by type
   - Email subscribe

3. **Phase 3 (Week 3+)**:
   - Social sharing
   - Analytics tracking
   - Roadmap integration
   - Downloadable PDFs

---

## Release Checklist

Use this checklist before each release:

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] No console errors in browser
- [ ] Linting clean (`npm run lint`)
- [ ] TypeScript builds without errors (`npm run build`)
- [ ] No security vulnerabilities (`npm audit`)

### Content Updates
- [ ] CHANGELOG.md updated with new version
- [ ] All commits linked in changelog table
- [ ] RELEASE_NOTES.md (if applicable) created
- [ ] API docs updated if endpoints changed
- [ ] Product docs updated with new features

### Version & Tags
- [ ] Version bumped in package.json
- [ ] Git tag created (`v0.1.0-beta`)
- [ ] Tag pushed to remote

### Testing
- [ ] Smoke tests passed on staging
- [ ] Core user flows tested (auth, watchlist, alerts)
- [ ] Mobile testing completed
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Performance benchmarks reviewed

### Deployment
- [ ] Environment variables verified
- [ ] Database migrations run (if applicable)
- [ ] Redis cache cleared
- [ ] CDN cache invalidated
- [ ] Monitoring alerts configured

### Communication
- [ ] Release notes drafted
- [ ] Social media posts scheduled
- [ ] Email announcement prepared
- [ ] Stakeholders notified
- [ ] Beta users informed (for beta releases)

### Post-Release
- [ ] Monitor error logs for 24 hours
- [ ] Track analytics for new features
- [ ] Review user feedback
- [ ] Plan next release based on feedback

---

## Automated Tools (Future)

When ready, automate releases with:

### Semantic Release (Recommended)
```bash
npm install --save-dev semantic-release @semantic-release/git @semantic-release/changelog
```

**Benefits**:
- Auto-determines version bump based on commits
- Auto-generates changelog
- Auto-creates tags and GitHub release
- Integrates with CI/CD

### Changelog Generation
```bash
# Manual generation (current approach)
# Already using this approach in CHANGELOG.md

# Future: Automated generation
# npm run generate-changelog
```

---

## FAQ

**Q: When do we move from beta to v1.0.0?**
A: When all core features are stable, API is finalized, and no major bugs remain. Estimated April 2026.

**Q: Can we skip v0.1.0 and go straight to v1.0.0?**
A: No. Beta versioning establishes the release pattern and gives users clear expectations.

**Q: What if we find a bug in a released tag?**
A: Create a hotfix branch, bump PATCH version, and re-release.

**Q: Should we backport fixes to previous beta versions?**
A: No. In beta, users should always upgrade to latest. No long-term support.

---

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Release Management](https://docs.github.com/en/repositories/releasing-projects-on-github/)

---

**Last Updated**: March 6, 2026  
**Author**: Zip (Research Agent)  
**Status**: Active (v0.1.0-beta)
