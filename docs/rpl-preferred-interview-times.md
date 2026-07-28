# RPL preferred interview times

After the final RPL question is saved and the completion screen is shown, the
student must submit two possible follow-up meeting times.

## Student-side rules

- Both choices are required and must be different.
- Choices must fall on Monday to Friday.
- Business hours are 9:00 am to 5:00 pm in the student's browser time zone.
- The completion day is excluded.
- Five complete Monday-to-Friday business days must pass before the earliest
  selectable meeting day.
- The form remains on screen when submission fails and can be retried.
- After a successful submission, the fields remain locked to prevent a second
  click in the same page session.

## Power Automate contract

Flow: `RPL - Student's Preferred Interview Times`

The HTTP trigger requires:

```json
{
  "FullName": "Student name",
  "ContactID": "123456",
  "CourseName": "Course or qualification name",
  "SubmittedAt": "Tuesday 28 July 2026 at 8:15 pm AEST",
  "FirstChoiceDateTime": "Wednesday 05 August 2026 at 10:00 am AEST",
  "SecondChoiceDateTime": "Thursday 06 August 2026 at 2:30 pm AEST"
}
```

The flow sends the existing internal Outlook notification and returns:

- HTTP 200 after the email action succeeds.
- HTTP 500 when the email action fails or times out.
