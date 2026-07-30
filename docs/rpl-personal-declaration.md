# RPL Personal Declaration

## Application behaviour

`AAMC RPL 2026.html` supplies the shared Student Information implementation
used by the Q3 and Q3 Auto Tester variants.

Pressing **Begin** now opens a mandatory Personal Declaration before the
question page is shown. The learner must:

- confirm that they understand the declaration;
- type a non-empty signature; and
- have a captured or uploaded photo in the current Student Information
  session.

The declaration **Submit** action combines the previous Begin workflow with the
declaration workflow. It:

1. ensures the student's SharePoint storage structure exists;
2. calls `RPL - Save Photo` to create
   `[Full Name] - [Contact ID] - Photo.jpg`;
3. saves the declaration and its separate declaration photo; and
4. only then starts the question workflow.

The `RPL - Save Photo` flow appends `.jpg`, so the application sends its
`FileName` value without the extension.

## HTTP request contract

Flow name:

`RPL - Personal Declaration`

The browser sends:

```json
{
  "FullName": "Billy Broker",
  "GivenName": "Billy",
  "ContactID": "123456",
  "Qualification": "FNS50322 Diploma of Finance and Mortgage Broking Management",
  "CourseName": "FNS50322 Diploma of Finance and Mortgage Broking Management",
  "Industry": "Mortgage Broking",
  "JobTitle": "Mortgage Broker",
  "PhotoDataUrl": "data:image/jpeg;base64,...",
  "DeclarationTitle": "Personal Declaration",
  "DeclarationText": "I Billy Broker confirm that:\n1. ...",
  "DeclarationAccepted": true,
  "Signature": "Billy Broker",
  "SignedAt": "2026-07-29T00:15:30.000Z",
  "SignedAtDisplay": "29 July 2026 at 10:15:30 am",
  "SignedAtFileNamePart": "2026-07-29 10-15-30",
  "StudentTimeZone": "Australia/Brisbane"
}
```

## Flow actions

The HTTP trigger must allow `Anyone` and use the request schema generated from
the sample above.

Use this trigger schema:

```json
{
  "type": "object",
  "properties": {
    "FullName": { "type": "string" },
    "GivenName": { "type": "string" },
    "ContactID": { "type": "string" },
    "Qualification": { "type": "string" },
    "CourseName": { "type": "string" },
    "Industry": { "type": "string" },
    "JobTitle": { "type": "string" },
    "PhotoDataUrl": { "type": "string" },
    "DeclarationTitle": { "type": "string" },
    "DeclarationText": { "type": "string" },
    "DeclarationAccepted": { "type": "boolean" },
    "Signature": { "type": "string" },
    "SignedAt": { "type": "string" },
    "SignedAtDisplay": { "type": "string" },
    "SignedAtFileNamePart": { "type": "string" },
    "StudentTimeZone": { "type": "string" }
  },
  "required": [
    "FullName",
    "GivenName",
    "ContactID",
    "Qualification",
    "CourseName",
    "Industry",
    "JobTitle",
    "PhotoDataUrl",
    "DeclarationTitle",
    "DeclarationText",
    "DeclarationAccepted",
    "Signature",
    "SignedAt",
    "SignedAtDisplay",
    "SignedAtFileNamePart",
    "StudentTimeZone"
  ]
}
```

Use SharePoint site:

`https://aamctraining.sharepoint.com/sites/AAMCData`

Use this folder expression for both files:

```text
concat(
  '/Documents/Compliance/RPL AssessorBot Stored Content/',
  triggerBody()?['FullName'],
  ' - ',
  triggerBody()?['ContactID']
)
```

### Save Student Declaration Photo

File name:

```text
concat(
  triggerBody()?['FullName'],
  ' - ',
  triggerBody()?['ContactID'],
  ' - Declaration Photo - ',
  triggerBody()?['SignedAtFileNamePart'],
  '.jpg'
)
```

File content:

```text
dataUriToBinary(triggerBody()?['PhotoDataUrl'])
```

### Save Personal Declaration

File name:

```text
concat(
  triggerBody()?['FullName'],
  ' - ',
  triggerBody()?['ContactID'],
  ' - ',
  triggerBody()?['Qualification'],
  ' - Declaration - ',
  triggerBody()?['SignedAtFileNamePart'],
  '.txt'
)
```

The text content should contain, in this order:

1. Declaration title.
2. Full name, given name and contact ID.
3. Qualification/course, industry and job title.
4. Signed date/time and student time zone.
5. Declaration accepted (`Yes` when true).
6. Typed signature.
7. The declaration photo file name.
8. The exact declaration text supplied in `DeclarationText`.

Use this expression for the file content:

```text
concat(
  triggerBody()?['DeclarationTitle'],
  decodeUriComponent('%0A%0A'),
  'Full Name: ', triggerBody()?['FullName'], decodeUriComponent('%0A'),
  'Given Name: ', triggerBody()?['GivenName'], decodeUriComponent('%0A'),
  'Contact ID: ', triggerBody()?['ContactID'], decodeUriComponent('%0A'),
  'Qualification: ', triggerBody()?['Qualification'], decodeUriComponent('%0A'),
  'Course Name: ', triggerBody()?['CourseName'], decodeUriComponent('%0A'),
  'Industry: ', triggerBody()?['Industry'], decodeUriComponent('%0A'),
  'Job Title: ', triggerBody()?['JobTitle'], decodeUriComponent('%0A'),
  'Signed: ', triggerBody()?['SignedAtDisplay'], decodeUriComponent('%0A'),
  'Student Time Zone: ', triggerBody()?['StudentTimeZone'], decodeUriComponent('%0A'),
  'Declaration Accepted: ',
  if(equals(triggerBody()?['DeclarationAccepted'], true), 'Yes', 'No'),
  decodeUriComponent('%0A'),
  'Signature: ', triggerBody()?['Signature'], decodeUriComponent('%0A'),
  'Declaration Photo: ',
  triggerBody()?['FullName'], ' - ', triggerBody()?['ContactID'],
  ' - Declaration Photo - ', triggerBody()?['SignedAtFileNamePart'], '.jpg',
  decodeUriComponent('%0A%0A'),
  triggerBody()?['DeclarationText']
)
```

Use a final HTTP Response action:

- status code: `200`
- body: `{"success":true,"message":"Personal declaration saved."}`

Add a failure Response action configured to run after either SharePoint action
fails or times out:

- status code: `500`
- body: `{"success":false,"message":"Personal declaration could not be saved."}`

The production application now uses the HTTP POST URL generated by the saved
`RPL - Personal Declaration` flow. If the trigger URL is regenerated, update
`WEBHOOK_URLS.personalDeclaration` in `public/AAMC RPL 2026.html`.
