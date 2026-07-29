# RPL preferred interview times

After the final RPL question is saved and the completion screen is shown, the
student must submit two possible follow-up meeting times.

## Student-side rules

- Both choices are required and must be on different days.
- Choices must fall on Monday to Friday.
- Business hours are 9:00 am to 5:00 pm in the student's browser time zone.
- Start and end times use half-hour increments only.
- A session cannot start after 4:30 pm or end after 5:00 pm.
- Each choice is submitted as a date with a start-to-end time range.
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
  "StudentTimeZone": "Australia/Brisbane",
  "FirstChoiceDate": "2026-08-05",
  "FirstChoiceStartTime": "13:00",
  "FirstChoiceEndTime": "16:00",
  "FirstChoiceTimeRange": "Wednesday 5th of August 1pm to 4pm",
  "SecondChoiceDate": "2026-08-06",
  "SecondChoiceStartTime": "09:00",
  "SecondChoiceEndTime": "12:30",
  "SecondChoiceTimeRange": "Thursday 6th of August 9am to 12:30pm"
}
```

The browser also sends `FirstChoiceDateTime` and `SecondChoiceDateTime` as
temporary aliases of the formatted range strings for backward compatibility
while the Power Automate trigger is updated.

The flow sends the existing internal Outlook notification and returns:

- HTTP 200 after the email action succeeds.
- HTTP 500 when the email action fails or times out.
