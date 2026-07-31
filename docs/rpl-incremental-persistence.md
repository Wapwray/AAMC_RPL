# RPL incremental persistence

## Purpose

The live RPL interview saves one compact JSON file for each submitted answer
instead of rewriting the complete transcript and AI performance log after every
attempt. When the interview reaches the final screen, the application writes the
three canonical output files once.

This reduces the amount of SharePoint data transferred as the interview grows
while preserving the existing final transcript and report contracts.

## Power Automate flows

| Flow | Management ID | Responsibility |
| --- | --- | --- |
| `RPL - Save Incremental Assessment Attempt` | `ea941f4a-33c1-4ea7-9e7b-f7ab004bba23` | Saves one compact attempt file and updates the current attempt marker. |
| `RPL - Get Incremental Assessment State` | `2c30da85-34db-4062-9d63-745219a38638` | Loads compact attempt files and current progress. It falls back to the legacy transcript files when no compact records exist. |
| `RPL - Reconstitute Assessment Files` | `c4bc67d9-93f5-412c-a0ca-ad4e849f0f00` | Writes the final AI performance log, JSON transcript and text transcript once the interview is complete. |

The previous combined-write flow is no longer used to rewrite complete
transcript files after every attempt. It is still called when the learner moves
to the next question so the legacy current-question marker, reset attempt
number, and cleared guidance-window file remain compatible with restart logic.

## SharePoint layout

Each attempt is stored in the student's existing `Transcription Backups`
directory using this filename:

```text
[Student Name] - [ContactID] - [Question Number] - [Attempt Number].json
```

The file contains:

- candidate and interview metadata needed to rebuild the final files;
- the question, objective, hint and preliminary assessment;
- the submitted answer and deterministic learner feedback;
- current-question and current-attempt state;
- only the AI performance-log entries created since the previous successful
  incremental save.

Records are merged deterministically by question and attempt number when an
interview resumes. Duplicate AI log entries are removed.

## Application behaviour

At startup, the application:

1. Calls `RPL - Get Incremental Assessment State`.
2. Rebuilds the in-memory interview from compact files when they exist.
3. Loads the old complete transcript files only when no compact attempt files
   exist, maintaining compatibility with interviews started before this change.

For a new interview, the application calls `RPL - New User - Create Structure`
with the candidate's accepted schema and waits for its `student_structure_ready`
response before questions can begin. This prevents question, resume and attempt
flows from racing the SharePoint initialization sequence.

After an answer is assessed, the application saves a single compact attempt
file. Progress-only updates use the same flow without creating an attempt file.
The compact-save flow creates missing `Transcription Backups` and `AI Log`
folders and upserts the current-attempt file. Resume treats absent optional
startup files as empty/default state rather than failing the request.

`RPL - Write Transcript and Update Question Number` now updates only the current
question, resets the current attempt to one, and clears the guidance state when
the learner moves to another question. It no longer accepts or rewrites the
complete transcript files. Each assessed response is still saved through
`RPL - Save Incremental Assessment Attempt`, which stores its current attempt
and guidance snapshot in the compact attempt record.

The question-transition flow is the sole owner of the attempt reset during a
Next Question transition. The browser does not start a second incremental
current-attempt write in parallel. Its SharePoint write actions use exponential
retry settings, and the current-attempt update has an additional delayed retry
after 60 seconds for SharePoint responses that report a storage problem as HTTP
400 with a `Retry-After` header.

On the final screen, the application waits for pending compact saves and then
calls `RPL - Reconstitute Assessment Files`. The existing canonical filenames
and report data contract are unchanged.

## Validation

The live flows were tested in two new sibling test directories:

- `Christian Dignan Incremental Test - 15606163`
- `Christian Dignan Legacy Resume Test - 15606163`

The original `Christian Dignan - 15606163` directory was not changed.

The incremental test verified compact save, compact resume and final
reconstitution. The legacy test verified that a student with no compact files
still resumes from the existing transcript files.

## Rollback

Revert the application deployment to the preceding Git revision. The previous
Power Automate flows and canonical files remain available, so rollback does not
require deleting compact files or test directories.

Do not delete the test directories or stop the previous combined-write flow
unless a separate cleanup has been approved.
