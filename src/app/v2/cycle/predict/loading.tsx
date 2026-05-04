/*
 * /v2/cycle/predict loading skeleton
 *
 * Predict page leads with a voice anchor card, then countdown +
 * fertility cards, then a methodology card. Feed variant matches
 * that vertical card stack. Wrapped in CycleSurface for NC cream
 * chrome consistency.
 */
import { LoadingShell } from '@/v2/components/states'
import CycleSurface from '../_components/CycleSurface'

export default function V2CyclePredictLoading() {
  return (
    <CycleSurface>
      <LoadingShell title="What's coming" variant="feed" />
    </CycleSurface>
  )
}
