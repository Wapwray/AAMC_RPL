# THIS IS A TEST - RPL 2026 V2

## Power Automate integration

This app now includes a protected Express endpoint for replacing the fragile RPL question-filtering logic in Power Automate.

Endpoint: `POST /api/rpl/filter`

Power Automate should keep doing orchestration only: manual trigger, learner/unit lookup, SharePoint question retrieval, HTTP call to this endpoint, Parse JSON, then use `studentQuestions` and `assessorQuestions` in emails or apps.

### HTTP action request body

Use this shape in the Power Automate HTTP action body:

```json
{
	"units": [],
	"questions": [],
	"config": {}
}
```

A complete example is in [docs/rpl-filter-example-request.json](docs/rpl-filter-example-request.json). The default config detects CT units where the status field starts with `CT`, extracts unit codes from `CODE`, `Code`, `Unit Code`, or `unitCode`, and excludes questions where `CT Do Not Ask 1` contains a matching CT unit code.

If SharePoint sends internal field names, add them in the admin config. For the current question list mapping, `CT Do Not Ask 1` may also appear as `field_6`.

### Authentication headers

Configure one of these environment variables in the Azure App Service application settings:

- `RPL_FILTER_API_KEY`: Power Automate sends this as an `x-api-key` header.
- `RPL_FILTER_BEARER_TOKEN`: Power Automate sends this as `Authorization: Bearer <token>`.

Optional environment variables:

- `RPL_FILTER_MAX_BODY_SIZE`: JSON request limit for Express, default `2mb`.
- `RPL_JSON_BODY_LIMIT`: fallback JSON request limit if `RPL_FILTER_MAX_BODY_SIZE` is not set.

The static admin page does not load or expose these secrets. For endpoint testing, paste the key/token into the page manually; it is not saved to localStorage.

### Expected response

The endpoint returns plain JSON arrays that Power Automate Parse JSON can consume:

```json
{
	"success": true,
	"unitCodes": [],
	"studentQuestions": [],
	"assessorQuestions": [],
	"includedQuestions": [],
	"excludedQuestions": [],
	"counts": {
		"unitsReceived": 0,
		"ctUnitsFound": 0,
		"unitCodes": 0,
		"questionsReceived": 0,
		"questionsIncluded": 0,
		"questionsExcluded": 0,
		"studentQuestions": 0,
		"assessorQuestions": 0
	},
	"warnings": [],
	"diagnostics": {}
}
```

A complete example is in [docs/rpl-filter-example-response.json](docs/rpl-filter-example-response.json).

### Parse JSON schema

Use [docs/rpl-filter-parse-json-schema.json](docs/rpl-filter-parse-json-schema.json) as the Power Automate Parse JSON schema. It keeps question objects flexible with `additionalProperties: true`, so SharePoint fields pass through without needing every column listed in the schema.

### Admin config page

Open [public/RPL Filter Admin.html](public/RPL%20Filter%20Admin.html) from the hosted app to configure filtering without editing code. It supports:

- Unit status and unit code field candidates.
- CT match modes: starts with CT, equals CT, custom prefix, and custom regex.
- Multiple exclusion fields and delimiter settings.
- Case sensitivity, live-field rules, selected output fields, diagnostics toggles.
- Import/export JSON config, localStorage save/load, and endpoint testing with pasted sample JSON.

Backend config persistence is not enabled because this app does not currently have a server-side config storage pattern. The admin page uses localStorage only.

### OpenAPI document

[docs/rpl-filter-openapi.yaml](docs/rpl-filter-openapi.yaml) can be used later as a starting point for a Power Platform custom connector.

### Deployment notes

The current hosting environment is a Node.js Express app deployed to Azure Web App by [.github/workflows/main_aamc-rpl-live.yml](.github/workflows/main_aamc-rpl-live.yml). The workflow installs packages, runs `npm run build`, runs `npm run test`, and deploys the generated artifact.

The reusable filter source lives at [src/rpl-filter/rplFilter.ts](src/rpl-filter/rplFilter.ts). `npm run build` compiles it to `dist/rpl-filter/rplFilter.js`, which [server.js](server.js) loads for `POST /api/rpl/filter`.

For local development:

```powershell
npm install
npm run build
$env:RPL_FILTER_API_KEY = "dev-test-key"
npm start
```

Then call `http://localhost:3000/api/rpl/filter` with header `x-api-key: dev-test-key`.
