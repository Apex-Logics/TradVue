/**
 * components/index.ts
 * Central barrel export for all shared UI components.
 *
 * ─── Loading / Skeleton ──────────────────────────────────────────────────────
 *
 * import Spinner from '@/app/components/Spinner'
 * import PageLoader from '@/app/components/PageLoader'
 * import Skeleton, { TextSkeleton, CardSkeleton, TableRowSkeleton, AvatarSkeleton } from '@/app/components/Skeleton'
 *
 * ─── Usage quick reference ───────────────────────────────────────────────────
 *
 * // Inline spinner (sm | md | lg | xl; variant: primary | accent | gain | loss | muted)
 * <Spinner />
 * <Spinner size="sm" variant="gain" />
 * <Spinner size="lg" color="#f0a500" />
 *
 * // Full-page loading overlay (route transitions, auth guards)
 * if (!ready) return <PageLoader />
 * if (loading) return <PageLoader minimal message="Fetching positions…" />
 *
 * // Skeleton placeholders
 * <Skeleton.Text />                         // single line
 * <Skeleton.Text lines={3} width="80%" />   // paragraph
 * <Skeleton.Card />                         // card with header + 3 lines
 * <Skeleton.Card header={false} lines={5} />
 * <Skeleton.TableRow columns={6} rows={8} showHeader />
 * <Skeleton.Avatar />
 * <Skeleton.Avatar size={48} shape="square" withLabel />
 *
 * ─── Named exports (for tree-shaking / granular imports) ─────────────────────
 */

// Loading
export { default as Spinner }          from './Spinner'
export type { SpinnerProps, SpinnerSize, SpinnerVariant } from './Spinner'

export { default as PageLoader }       from './PageLoader'
export type { PageLoaderProps }        from './PageLoader'

// Skeleton (default = namespace object; named = individual)
export { default as Skeleton }         from './Skeleton'
export {
  TextSkeleton,
  CardSkeleton,
  TableRowSkeleton,
  AvatarSkeleton,
}                                      from './Skeleton'
export type {
  TextSkeletonProps,
  CardSkeletonProps,
  TableRowSkeletonProps,
  AvatarSkeletonProps,
  AvatarSkeletonShape,
}                                      from './Skeleton'

// Existing components (re-exported; use named imports matching each file's exports)
export * from './AlertSystem'
export { default as AuthModal }           from './AuthModal'
export { default as Celebration }         from './Celebration'
export { default as CookieConsent }       from './CookieConsent'
export * from './EmptyState'
export { default as KeyboardShortcuts }   from './KeyboardShortcuts'
export { default as OnboardingChecklist } from './OnboardingChecklist'
export { default as OnboardingOverlay }   from './OnboardingOverlay'
export { default as OnboardingTooltip }   from './OnboardingTooltip'
export { default as SettingsPanel }       from './SettingsPanel'
export { default as WelcomeModal }        from './WelcomeModal'
