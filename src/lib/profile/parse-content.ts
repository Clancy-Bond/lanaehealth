/**
 * health_profile.content parser
 *
 * Session 2 / W2.6: PUT /api/profile used to call JSON.stringify(content) before
 * upserting into a jsonb column, so existing rows are a mix of:
 *   a) raw objects (written by importers via supabase-js)
 *   b) JSON-stringified strings (written by the old PUT handler)
 *
 * We fix the writer (see route.ts) but do NOT mutate existing rows -- zero data
 * loss. Every reader of health_profile.content must therefore run the value
 * through this parser so both shapes stay transparent.
 *
 * If the input is a string that is valid JSON, return the parsed value.
 * If it is a string that is NOT valid JSON, return the raw string (a legitimate
 *   content shape for some sections is a plain string, e.g. full_profile).
 * If it is anything else (object, array, number), return it unchanged.
 */
export function parseProfileContent(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}
