/*
 * /v2/cycle/predict loading skeleton
 *
 * Predict page leads with a voice anchor card, then countdown +
 * fertility cards, then a methodology card. Feed variant matches
 * that vertical card stack.
 */
import { LoadingShell } from '@/v2/components/states'

export default function V2CyclePredictLoading() {
  return <LoadingShell title="What's coming" variant="feed" />
}
