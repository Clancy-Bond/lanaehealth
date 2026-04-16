/**
 * Legacy Bridge Parser
 *
 * Bridges the existing importers (Apple Health, MyNetDiary, Natural Cycles)
 * to the new canonical record format. These importers write directly to Supabase,
 * so this bridge returns a message directing users to the existing import flow.
 */

import type { DetectedFormat, ParseResult, Parser } from '../types'

const legacyBridgeParser: Parser = {
  supportedFormats: ['apple-health-xml', 'csv-mynetdiary', 'csv-natural-cycles'],

  async parse(_content: string | Buffer, format: DetectedFormat, _fileName?: string): Promise<ParseResult> {
    const appNames: Record<string, string> = {
      'apple-health-xml': 'Apple Health',
      'csv-mynetdiary': 'MyNetDiary',
      'csv-natural-cycles': 'Natural Cycles',
    }

    const routes: Record<string, string> = {
      'apple-health-xml': '/api/import/apple-health',
      'csv-mynetdiary': '/api/import/mynetdiary',
      'csv-natural-cycles': '/api/import/natural-cycles',
    }

    const appName = appNames[format] ?? 'Unknown'
    const route = routes[format] ?? ''

    return {
      records: [],
      warnings: [
        `${appName} detected. This format has a dedicated importer at ${route}. ` +
        `The file will be routed to the existing ${appName} import pipeline.`,
      ],
      errors: [],
      metadata: {
        totalExtracted: 0,
        byType: {},
        dateRange: null,
        sourceName: appName,
      },
    }
  },
}

export default legacyBridgeParser
