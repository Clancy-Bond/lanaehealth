/*
 * /v2 top-level loading skeleton
 *
 * Renders during cold loads anywhere in /v2 that does not have its
 * own loading.tsx. Matches the home shape: hero strip + insight
 * card + metric strip + shortcuts grid.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2Loading() {
  return <LoadingShell title="Home" variant="hero" />
}
