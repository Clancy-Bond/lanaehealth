# Apple Health Shortcut: daily sync into LanaeHealth

This is the recipe the iOS Shortcut needs to follow so Natural Cycles
data (and any other Apple Health sample Lanae wants) lands in
LanaeHealth automatically, without the full `export.xml` dump.

Endpoint lives at [`/api/health-sync`](../../src/app/api/health-sync/route.ts).
Bearer-token auth via `HEALTH_SYNC_TOKEN` in `.env.local`. Every write
is an upsert keyed on date, so the Shortcut is safe to run daily or on
a timer without creating duplicates.

## Endpoint contract

```
POST https://lanaehealth.vercel.app/api/health-sync
Authorization: Bearer <HEALTH_SYNC_TOKEN>
Content-Type: application/json

{
  "menstrualFlow": [
    { "date": "2026-04-18", "value": "medium" }
  ],
  "basalTemp": [
    { "date": "2026-04-18", "celsius": 36.55 }
  ],
  "cervicalMucus": [
    { "date": "2026-04-18", "value": "egg_white" }
  ],
  "ovulationTest": [
    { "date": "2026-04-18", "value": "positive" }
  ]
}
```

Response:

```json
{
  "synced": {
    "menstrualFlow": 1,
    "basalTemp": 1,
    "cervicalMucus": 1,
    "ovulationTest": 1
  },
  "dateRange": { "from": "2026-04-18", "to": "2026-04-18" },
  "errors": []
}
```

### Accepted value vocabularies

| Field | Values |
|---|---|
| `menstrualFlow.value` | `none`, `unspecified`, `light`, `medium`, `heavy` (or the HK integer 1–5) |
| `cervicalMucus.value` | `dry`, `sticky`, `creamy`, `watery`, `egg_white` (or HK integer 1–5) |
| `ovulationTest.value` | `negative`, `positive`, `indeterminate` (or HK integer 1–3) |
| `basalTemp.celsius` | Decimal degrees C |
| `basalTemp.fahrenheit` | Decimal degrees F (will be converted) |

### Alternative payload shape (raw HealthKit samples)

If the Shortcut pipes "Find Health Samples" output directly without
reshape steps, the endpoint also accepts:

```json
{
  "samples": [
    {
      "type": "HKCategoryTypeIdentifierMenstrualFlow",
      "startDate": "2026-04-18T09:00:00Z",
      "value": "medium"
    },
    {
      "type": "HKQuantityTypeIdentifierBasalBodyTemperature",
      "startDate": "2026-04-18T07:00:00Z",
      "value": 36.55
    }
  ]
}
```

Supported `type` strings: `HKCategoryTypeIdentifierMenstrualFlow`,
`HKQuantityTypeIdentifierBasalBodyTemperature`,
`HKCategoryTypeIdentifierCervicalMucusQuality`,
`HKCategoryTypeIdentifierOvulationTestResult`.

## Recipe for the iOS Shortcut

Open the Shortcuts app, create "LanaeHealth Sync":

1. **Dictionary** action - name it `payload`. Leave empty; later steps
   add keys.
2. **Find Health Samples** action
    - Type: `Menstrual Flow`
    - Sort: `End Date` descending
    - Limit: `7` (last week)
3. **Repeat with Each** (`Repeated Item` = output of step 2)
    - **Get Dictionary from Input** - convert the HK sample
    - **Get Value for** `End Date` - save as `Sample Date`
    - **Format Date** `Sample Date` → `2026-04-18` (yyyy-MM-dd)
    - **Get Value for** `Value` - save as `Sample Value`
    - **Dictionary**: build `{ "date": Formatted Date, "value": Sample Value }`
    - **Add to Variable** `menstrualFlow` ← the dictionary
4. Repeat the same block for **Basal Body Temperature**, **Cervical
   Mucus Quality**, and **Ovulation Test Result** - adjust the
   dictionary shape per the table above.
5. **Set Dictionary Value** on `payload`
    - Key `menstrualFlow` ← `menstrualFlow` variable
    - Key `basalTemp` ← `basalTemp` variable
    - Key `cervicalMucus` ← `cervicalMucus` variable
    - Key `ovulationTest` ← `ovulationTest` variable
6. **Get Contents of URL**
    - URL: `https://lanaehealth.vercel.app/api/health-sync`
    - Method: `POST`
    - Headers:
        - `Authorization` → `Bearer <paste HEALTH_SYNC_TOKEN>`
        - `Content-Type` → `application/json`
    - Request Body: `JSON`, set to `payload`
7. **Show Notification** with the response body (optional, handy to
   confirm it landed).

### Automation

Shortcuts → Automation tab → Create Personal Automation → Time of Day
→ 08:00 daily → Add Shortcut → pick "LanaeHealth Sync" → turn off
"Ask Before Running". That runs the sync every morning after NC has
updated Apple Health overnight.

### Manual trigger

Add the shortcut to the Home Screen for a one-tap "sync now" button.

## Retargeting an existing Shortcut

If a Shortcut that points at a different URL already exists:

1. Open Shortcuts → edit the existing "LanaeHealth Sync" shortcut.
2. Find the **Get Contents of URL** step.
3. Change the URL to `https://lanaehealth.vercel.app/api/health-sync`.
4. Replace the `Authorization` header value with
   `Bearer <HEALTH_SYNC_TOKEN from .env.local>`.
5. Make sure `Content-Type` is `application/json` and the body is the
   JSON payload.

## Verifying it worked

After the Shortcut runs:

- Response body will contain `synced.menstrualFlow: N` and a
  non-empty `dateRange` if any rows were written.
- Home page (`/`) will show the right cycle day / phase without the
  "Heads up: last period was N days ago" banner if the new data
  pushed the cycle start forward.
- Direct query in Supabase Studio:
  ```sql
  SELECT date, menstruation, flow_quantity, temperature, data_flags
  FROM nc_imported
  WHERE data_flags = 'apple_health_shortcut'
  ORDER BY date DESC
  LIMIT 14;
  ```
  `data_flags` marks every row that came through the Shortcut so it's
  easy to tell apart from the full-export path.

## Error responses

| Status | Body | Meaning |
|---|---|---|
| 401 | `{"error":"Unauthorized"}` | Missing or wrong `Authorization` header. |
| 400 | `{"error":"Body must be valid JSON."}` | Payload was not parseable JSON. |
| 500 | `{"error":"HEALTH_SYNC_TOKEN is not configured on the server."}` | Environment is missing the token. |
| 200 | `{"synced":{...},"errors":["..."]}` | Some rows landed; check `errors` for any per-row failures. |
