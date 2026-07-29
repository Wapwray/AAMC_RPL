# Excluded Question Reasons

The RPL filter keeps the decision rule and the assessor-facing explanation
separate:

- `CT Do Not Ask 1` contains the unit codes used to decide whether a question
  is excluded for credit transfer.
- `Do Not Ask If` contains the readable explanation that may be shown under
  **Excluded Questions** in the assessor email.

Each excluded question is represented in `diagnostics.excludedBy` with:

```json
{
  "questionIndex": 5,
  "fields": ["CT Do Not Ask 1"],
  "unitCodes": ["FNSFMK515"],
  "exclusionType": "creditTransfer",
  "reason": "The student already holds the relevant unit by credit transfer.",
  "reasonField": "Do Not Ask If"
}
```

Power Automate should use `reason` for the **Why it was not listed** value.
When `Do Not Ask If` is blank, the API supplies a neutral generated fallback:

- credit transfer: `Credit transfer recorded for [unit codes].`
- managed staff: `This question is only asked when the student has managed staff.`

The readable `Do Not Ask If` text never changes the exclusion decision. Credit
transfer exclusions still require a matching unit code in `CT Do Not Ask 1`.

