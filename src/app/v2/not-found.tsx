/*
 * /v2 not-found surface
 *
 * Triggered automatically when a request inside the /v2 segment hits a
 * route that does not exist, or when a server component calls notFound().
 * Stays inside v2 chrome so the user is not bounced to the default Next
 * 404 page that has no nav and no theming.
 *
 * NC voice: short, kind, with a clear next step. The shared
 * NotFoundState shell renders the same surface across the app so 404s
 * feel consistent regardless of where the user lands.
 */
import { NotFoundState } from '@/v2/components/states'

export default function V2NotFound() {
  return <NotFoundState />
}
