/*
 * CycleTopicIntroBanner
 *
 * One-sentence framing banner at the top of the /v2/topics/cycle
 * deep-dive. States the ACOG typical range and reminds the reader
 * that phase tends to matter more than day count for how they feel.
 *
 * Kept deliberately short: this is a reading page, not a dashboard.
 */
import { Banner } from '@/v2/components/primitives'

export default function CycleTopicIntroBanner() {
  return (
    <Banner
      intent="info"
      title="About this page"
      body="ACOG considers 21 to 35 day cycles typical. Phase tends to shape how you feel more than day count does."
    />
  )
}
