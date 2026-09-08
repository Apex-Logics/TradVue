import { redirect } from 'next/navigation'

// Bare /legal has no standalone document. Send visitors to Privacy — the
// existing policy most people look for — rather than inventing new copy.
export default function LegalIndexPage() {
  redirect('/legal/privacy')
}
