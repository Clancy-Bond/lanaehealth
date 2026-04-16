/**
 * Integration Registry
 *
 * Registers all available connectors with the hub.
 * Import this file to initialize all integrations.
 */

import { registerConnector } from './hub'
import dexcomConnector from './connectors/dexcom'
import whoopConnector from './connectors/whoop'
import garminConnector from './connectors/garmin'
import withingsConnector from './connectors/withings'
import fhirPortalConnector from './connectors/fhir-portal'
import fitbitConnector from './connectors/fitbit'

// Register all connectors
registerConnector(dexcomConnector)
registerConnector(whoopConnector)
registerConnector(garminConnector)
registerConnector(withingsConnector)
registerConnector(fhirPortalConnector)
registerConnector(fitbitConnector)

// Note: Oura Ring uses the existing integration at src/lib/oura.ts
// It will be migrated to this hub pattern in a future update.

export { dexcomConnector, whoopConnector, garminConnector, withingsConnector, fhirPortalConnector, fitbitConnector }
