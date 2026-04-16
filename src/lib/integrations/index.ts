/**
 * Integration Hub -- Entry Point
 *
 * Usage:
 *   import '@/lib/integrations' // Registers all connectors
 *   import { getAllConfigs, syncIntegration } from '@/lib/integrations/hub'
 */

// Initialize all connectors
import './registry'

export {
  getAllConfigs,
  getConnector,
  getStatus,
  getAllStatuses,
  syncIntegration,
  getToken,
  saveToken,
  deleteToken,
} from './hub'

export type {
  IntegrationId,
  IntegrationConfig,
  IntegrationToken,
  IntegrationStatus,
  Connector,
  SyncResult,
  DataType,
  OAuthConfig,
} from './types'
