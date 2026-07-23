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

## RPL AI configuration

The active assessment model is GPT-5.4-Mini through Azure OpenAI Responses API.

- Prompt-pack version: `3.0`
- Reasoning effort: `medium`
- Active question-assessment prompt: [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js)
- Assessment integration module: [public/rpl-assessor-decision.js](public/rpl-assessor-decision.js)
- Transcript-check prompt integration: [public/rpl-final-report-generator.js](public/rpl-final-report-generator.js)
- Shared assessment schemas: [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js)

Prompt usage:

- Prompt A: question assessment in [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js)
- Prompt B: transcript/report-readiness quality check in [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js)
- Prompt C: final-report structured prompt kept in [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js) for matching future report stages

Structured Outputs:

- Assessment schema: `RPL_ASSESSMENT_SCHEMA`
- Transcript-check schema: `RPL_TRANSCRIPT_CHECK_SCHEMA`
- Final-report schema: `RPL_FINAL_REPORT_SCHEMA`

Azure environment variables:

- `RPL_ASSESSOR_API_KEY`
- `RPL_ASSESSOR_AZURE_ENDPOINT`
- `RPL_ASSESSOR_DEPLOYMENT`
- `RPL_ASSESSOR_MODEL_NAME`
- `RPL_ASSESSOR_API_VERSION` when using legacy or azure-native API style
- `RPL_ASSESSOR_API_STYLE` optional override
- `RPL_FINAL_API_KEY`
- `RPL_FINAL_AZURE_ENDPOINT`
- `RPL_FINAL_DEPLOYMENT`
- `RPL_FINAL_MODEL_NAME`
- `RPL_FINAL_API_VERSION` when using legacy or azure-native API style
- `RPL_FINAL_API_STYLE` optional override

Token and timeout settings:

- Check Response default request cap: `1600` output tokens
- Check Response bounded retry cap on incomplete GPT-5.4 output: `3000` output tokens
- Transcript quality check cap: `5000` output tokens
- Final-report structured request reserve: `9000` output tokens
- Azure request timeout: `120000` ms
- Question-assessment UI retry remains bounded to incomplete output only; unfavourable results are not retried

Regression tests:

- Deterministic prompt-pack and invariant tests: `node --test tests/rplPromptPackV3.test.js`
- Existing assessor and report tests: `node --test tests/rplAssessorDecision.test.js tests/rplPreliminaryReview.test.js`
- Full CI test entrypoint: `npm test`

Optional live-model tests:

- Set `RPL_RUN_LIVE_PROMPT_TESTS=1`
- Optionally set `RPL_LIVE_TEST_URL` if the local server is not running at `http://127.0.0.1:3000/api/analysis/chat`
- Run `node --test tests/rplPromptPackV3.live.test.js`

Rollback:

- Revert [public/rpl-prompt-pack-v3.js](public/rpl-prompt-pack-v3.js)
- Revert the GPT-5.4 Structured Outputs wiring in [server.js](server.js)
- Revert the V3 prompt-pack consumers in [public/rpl-assessor-decision.js](public/rpl-assessor-decision.js), [public/AAMC RPL 2026.html](public/AAMC%20RPL%202026.html), and [public/rpl-final-report-generator.js](public/rpl-final-report-generator.js)
- Keep archived historical prompt references in [docs/gpt-prompts-archive.md](docs/gpt-prompts-archive.md) and [docs/deepseek-prompts-archive.md](docs/deepseek-prompts-archive.md)
