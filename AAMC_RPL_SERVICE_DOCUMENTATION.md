# AAMC RPL 2026 Q3 - Complete Service Documentation

**Generated:** 2026-07-23  
**System Version:** 1.9  
**Purpose:** Comprehensive technical specification for AI-assisted vocational RPL assessment platform

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Objectives](#objectives)
3. [Content Structure](#content-structure)
4. [Question Anatomy](#question-anatomy)
5. [Azure OpenAI Prompt (Primary)](#azure-openai-prompt-primary)
6. [DeepSeek-V4-Flash Prompt (Alternative)](#deepseek-v4-flash-prompt-alternative)
7. [AI Mode Selection](#ai-mode-selection)
8. [Data Flow](#data-flow-how-answers-become-reports)
9. [Key Technical Components](#key-technical-components)
10. [Prompt Comparison Analysis](#prompt-comparison-analysis)
11. [Implementation Details](#implementation-details)

---

## System Overview

The AAMC RPL (Recognition of Prior Learning) system is an **AI-assisted vocational assessment platform** designed specifically for Australian finance qualifications. It evaluates candidates' prior learning against **FNS50322** (Diploma of Finance and Mortgage Broking Management) and closely related Australian finance, lending, and mortgage broking credentials.

### Core Purpose

- Conduct structured interviews with candidates to collect verbal/text evidence of job competencies
- Use AI (Azure OpenAI or DeepSeek) to evaluate responses against qualification objectives
- Provide targeted guidance when evidence is insufficient, allowing up to 3 attempts per question
- Generate assessor-ready preliminary review reports
- Maintain complete audit trails of all responses, attempts, and AI feedback

### Deployment Context

- **Platform:** Web-based HTML5 application
- **Authentication:** Microsoft Entra ID / OAuth 2.0
- **Backend:** Power Automate webhooks (23 endpoints)
- **Speech Recognition:** Azure Speech SDK v1.41.0
- **Hosting:** Azure App Service
- **Current Version:** V1.9

---

## Objectives

### Primary Objectives

1. **Evidence Collection**
   - Conduct interviews with candidates to collect verbal/text evidence of job competencies
   - Support both speech recognition (microphone) and text input modes
   - Record all evidence with timestamps and attempt numbers

2. **AI-Assisted Assessment**
   - Evaluate responses against qualification objectives using Azure OpenAI (default) or DeepSeek (alternative)
   - Provide consistent, objective assessment aligned to Australian vocational competency standards
   - Support mode switching to compare assessor strategies

3. **Structured Feedback Loop**
   - Provide targeted guidance when evidence is insufficient
   - Allow up to 3 attempts per question with attempt-aware assessment
   - Combine multiple attempts into unified assessment (not isolated)

4. **Assessor-Ready Reports**
   - Generate preliminary review reports suitable for qualified human assessors
   - Include AI Interview Summaries formatted for readability
   - Provide structured question-by-question breakdown
   - Support compliance documentation

5. **Transcript Preservation**
   - Maintain complete audit trails of all responses, attempts, and AI feedback
   - Support resume/recovery for interrupted assessments
   - Enable transcript export and backup

### Secondary Objectives

- Reduce assessment time for both candidates and assessors
- Provide consistent evidence evaluation across all candidates
- Support multiple assessment modes (Azure OpenAI vs. DeepSeek)
- Enable rate-limiting protection for third-party AI models
- Track assessment metrics and candidate performance

---

## Content Structure

### Assessment Architecture: Three Phases

#### **Phase 1: Welcome & Onboarding**

**Purpose:** Collect candidate metadata and configure assessment parameters

**User Inputs:**
- Full name (e.g., "Billy Broker")
- Given name (e.g., "Billy")
- Contact ID (e.g., "123456")
- Photo capture (webcam or file upload)
- Industry selection (Banking, Lending, Mortgage Broking, Finance Broking)
- Job title (text input)
- Optional: "Have you managed staff?" (affects question personalization)
- Optional: AI Mode toggle (Azure OpenAI vs. DeepSeek)

**Data Persistence:**
- Stored in window.RPLStudentInfo object
- URL parameters: fullName, givenName, contactId, managedStaff
- localStorage keys: rplMicDeviceId, rpl_use_deepseek

**UI Components:**
- Welcome screen with AAMC logo
- Camera selector dropdown
- Photo preview/capture controls
- Industry dropdown
- Job title text field
- Managed staff toggle
- AI Assessor mode toggle
- "Begin Assessment" button (disabled until requirements met)

#### **Phase 2: AI-Assisted Interview Loop**

**Purpose:** Conduct structured interview with AI-assisted feedback

**Question Structure (per question):**

```
QUESTION DISPLAY:
├─ Question number and section (e.g., "Compliance - Question 1 of 20")
├─ Question text
├─ Objective statement
└─ Optional hint (Show Hint button)

ANSWER COLLECTION:
├─ Textarea for typed response
├─ Speech transcription controls
│  ├─ Microphone selector dropdown
│  ├─ "Start Transcription" button
│  ├─ Audio meter showing mic level
│  ├─ Playback widget with time tracking
│  └─ Recording status indicator
└─ Character count / input validation

AI ASSESSMENT (Check Response):
├─ Send: question + objective + hint + all attempts + metadata
├─ Receive: JSON assessment
├─ Timer showing response time (0.0s - 20.0s)
└─ Display "Guidance" (learner-facing feedback)

DECISION LOGIC:
├─ If "LIKELY SUFFICIENT" → enable "Next Question" button
├─ If "ADDITIONAL EVIDENCE MAY BE NEEDED" + attempts < 3:
│   └─ Re-enable textarea for retry, disable "Next Question"
└─ If attempts = 3 → automatically enable "Next Question"

PROGRESSION:
└─ Click "Next Question" to advance
```

**Question Loop Lifecycle:**

```
For each question (typically 5-20 in assessment):
  1. Load question metadata
  2. Display question + objective + hint
  3. Loop: Answer Collection (up to 3 attempts):
     a. Candidate enters response
     b. Click "Check Response"
     c. Send to AI with full attempt history
     d. Receive assessment JSON
     e. Display guidance
     f. If LIKELY SUFFICIENT: break loop
     g. If ADDITIONAL EVIDENCE + attempts < 3: allow retry
  4. Click "Next Question"
  5. Apply 15s cooldown if DeepSeek mode
  6. Load next question
End loop
```

#### **Phase 3: Completion & Report Generation**

**Purpose:** Finalize assessment and generate assessor-ready report

**Completion Sequence:**

```
1. User completes final question
2. "Next Question" button disabled
3. Completion screen displayed
4. Finalizing overlay shows: "We are saving your responses"
5. Background: buildFullTranscript() generates text transcript
6. Background: buildFullTranscriptJson() generates structured data
7. Background: buildPreliminaryReviewReport() generates HTML
8. Report sent via Power Automate webhook
9. Success page displays with download/close options
10. Candidate can optionally view preliminary report
```

**Completion Screen:**

```
Thank you [Given Name]. Your responses have been submitted.

A qualified assessor will review your evidence and contact you if needed.
You can now close this window.
```

---

## Question Anatomy

### Question Data Structure

Each question in the assessment contains:

```json
{
  "id": "q-001-regulatory-change",
  "questionNumber": 1,
  "section": "Compliance",
  "Title": "Regulatory Compliance Question",
  
  "field_2": "Identify a recent regulatory change in your industry and explain how it has affected your daily work practice.",
  "objective": "Identify a specific regulatory change, explain its impact on work procedures, and describe practical changes made",
  "hint": "Consider regulatory changes such as RG209 (RG209 amendments), BID (Best Interest Duty), or other industry-specific compliance requirements. Think about what changed in your daily procedures.",
  
  "unitCode": "FNS40821",
  "unitTitle": "Certificate IV in Finance and Mortgage Broking",
  "assessmentCriteria": [
    "Identify a specific regulatory change",
    "Relate change to their role/industry",
    "Describe practical impact on work"
  ],
  "requiredEvidence": [
    "Reference to specific regulatory document or change",
    "Description of work impact",
    "Evidence of updated procedures"
  ],
  
  "attempts": [
    {
      "attemptNumber": 1,
      "answer": "A recent regulatory change was the best interest duty legislation...",
      "feedback": "AI guidance and assessment JSON",
      "submittedAt": "2026-07-23T14:32:00Z",
      "aiAssessment": {
        "overallAssessment": "LIKELY SUFFICIENT",
        "covered": ["..."],
        "missing": [],
        "confidence": "high"
      }
    },
    {
      "attemptNumber": 2,
      "answer": "...",
      "feedback": "...",
      "submittedAt": "2026-07-23T14:35:00Z",
      "aiAssessment": { "..." }
    }
  ],
  
  "aiInterviewSummary": "Dikki identified the Best Interest Duty as a recent regulatory change...",
  "overallAssessment": "LIKELY SUFFICIENT"
}
```

### Question Display in UI

```
┌─────────────────────────────────────────────────────────┐
│ Compliance - Question 1 of 20 - Attempt 1   [Show Hint] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ Identify a recent regulatory change in your industry     │
│ and explain how it has affected your daily work practice.│
│                                                           │
├─────────────────────────────────────────────────────────┤
│ Guidance                                                 │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (AI feedback appears here after Check Response)      │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ Your response                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [Textarea for candidate input]                       │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                           [Check Response]              │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                  [Next Question] (disabled)             │
└─────────────────────────────────────────────────────────┘
```

---

## Azure OpenAI Prompt (Primary)

### System Instruction

```
You are an expert Australian financial services RPL assessor and evidence reviewer 
for vocational competency outcomes aligned to FNS50322 Diploma of Finance and Mortgage 
Broking Management, FNS40821 Certificate IV in Finance and Mortgage Broking, and closely 
related Australian finance, lending, and mortgage broking qualifications.

Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

Your only task is to assess the combined evidence in the learner attempts against 
the supplied question, objective, and hint.
```

### Critical Consistency Rules

1. **Treat all attempts as one combined response**
   - Do not assess each attempt in isolation
   - The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts
   - Do not ask for repetition or extra detail just because the response is a single long answer

2. **Handle multiple attempts fairly**
   - A later attempt may add evidence that was missing from an earlier attempt
   - The learner has up to 3 attempts to build their complete response
   - Do not ask the learner to repeat evidence they have already provided in a previous attempt

3. **Missing parts require completeness**
   - If required parts of the question/objective are still missing in the combined evidence, mark ADDITIONAL EVIDENCE MAY BE NEEDED

### Assessment Rules

1. **Primary Evaluation Criteria**
   - Evaluate primarily against the question text and objective
   - Ensure the learner's combined response directly answers the specific question asked, not just adjacent or generic commentary
   - Use candidateMetadata.industry and candidateMetadata.jobTitle as assessment context to judge whether examples and terminology are appropriate to the learner's role and sector

2. **Context-Aware Assessment**
   - Use industry/job-title context to interpret evidence relevance and depth expectations
   - Do not fail a response only for wording differences if competency evidence is clear
   - Treat appropriate and professional behaviour as an implicit core requirement of every question

3. **Professional Conduct Assessment**
   - Do not credit described actions, strategies or attitudes that a competent professional in the learner's role would consider unprofessional, disrespectful, discriminatory, unethical or contrary to the client's best interests as valid evidence, even if they superficially relate to the question topic
   - If any attempt shows disregard for client best interests, ethical duties or legal obligations relevant to the learner's role, the overallAssessment must be ADDITIONAL EVIDENCE MAY BE NEEDED regardless of other evidence
   - Set professionalConductConcern to true when any attempt may have displayed inappropriate, unprofessional, discriminatory or unethical behaviour, racist, sexist, homophobic or misogynistic language, or disregard for client best interests or legal obligations
   - Set it to false otherwise (do not set to true merely for informal language, brevity or a weak but good-faith answer)

### Hint Handling Rules

1. **Treat hint as directional guidance only**
   - Use the hint to guide expectations about broad coverage and level of detail
   - Never quote, paraphrase, list, or reveal hint content in any returned field
   - The hint is the same content the learner can access with the Show Hint button
   - Never require every hint detail

2. **Hint support assessment**
   - If the hint would help with a missing part of the response, set hintWouldHelp to true
   - Keep missing generic enough that it does not reveal the hint or a model answer

### Sufficiency Calibration

**Mark LIKELY SUFFICIENT when:**
- Response addresses every core requirement in the objective
- Evidence directly relates to the question
- Evidence is relevant to learner's role/industry
- Learner provides enough practical information to identify what occurred, what they did, or how their work was affected
- Response is concise but still clear and meaningful
- Learner uses informal workplace language rather than formal regulatory or training terminology
- Answer contains minor spelling, grammar or terminology errors that do not prevent the meaning from being understood
- Not every detail suggested by the hint is present, provided the objective has been met

**Mark ADDITIONAL EVIDENCE MAY BE NEEDED when:**
- Core requirement from objective/question not addressed
- Response too vague to determine what learner actually did
- Learner discusses related topic but doesn't answer the question
- Important statements unclear or unsupported
- Response consists only of generic claims with no practical content
- Evidence includes conduct inconsistent with professional/ethical practice

### Objective Evidence Breakdown Rules

1. **Component Decomposition**
   - Break the objective into its distinct component parts (typically 2 to 5)
   - Return one objectiveEvidence item per part

2. **Part Labeling**
   - objectivePart must be a short neutral label for that part of the objective, 10 words or fewer
   - Each part's status must be LIKELY SUFFICIENT or ADDITIONAL EVIDENCE MAY BE NEEDED

3. **Evidence Quotation**
   - When a part is LIKELY SUFFICIENT, evidence must be a short direct quote or close paraphrase (25 words or fewer) of the learner's own wording that meets that part
   - When a part is ADDITIONAL EVIDENCE MAY BE NEEDED, evidence must be a short quote of any partial learner evidence for that part, or an empty string if none exists
   - Evidence must come only from the learner's attempts. Never place hint content, model answers, or suggested wording in evidence

### Output Length Rules

- covered: at most 3 items, each 12 words or fewer
- missing: at most 3 items, each 12 words or fewer
- assessorRationale: one sentence of 30 words or fewer
- objectiveEvidence: at most 5 parts; each objectivePart 10 words or fewer; each evidence quote 25 words or fewer
- Entire JSON response: under 300 words

### JSON Output Schema

```json
{
  "overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
  
  "covered": [
    "short neutral evidence point (≤12 words)",
    "another covered point",
    "third covered point"
  ],
  
  "missing": [
    "short neutral missing requirement (≤12 words)",
    "another gap if ADDITIONAL EVIDENCE needed"
  ],
  
  "objectiveEvidence": [
    {
      "objectivePart": "component of objective (≤10 words)",
      "status": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
      "evidence": "quote or paraphrase from learner (≤25 words) or empty string"
    },
    {
      "objectivePart": "second component (≤10 words)",
      "status": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
      "evidence": "second evidence quote or paraphrase"
    }
  ],
  
  "hintWouldHelp": false,
  
  "professionalConductConcern": false,
  
  "assessorRationale": "one sentence explaining the status, third person, not addressed to learner (≤30 words)",
  
  "confidence": "high | medium | low"
}
```

### Example Azure OpenAI Assessment

**Question:** "Identify a recent regulatory change in your industry and explain how it has affected your daily work practice."

**Objective:** "Identify a specific regulatory change, explain its impact on work procedures, and describe practical changes made"

**Learner Answer (Attempt 1):**
```
A recent regulatory change was the best interest duty legislation. 
This means we have to provide more detailed fact-finding. 
We now complete a credit guide and provide a Statement of Credit Assistance.
This has changed how we work with customers.
```

**Learner Answer (Attempt 2):**
```
In addition to that, we document more things in the CRM now.
We have to show quantitative and qualitative notes demonstrating clearly 
why we recommended that lender to the customer.
```

**Azure OpenAI Response:**

```json
{
  "overallAssessment": "LIKELY SUFFICIENT",
  
  "covered": [
    "Identifies BID legislation as regulatory change",
    "Describes practical procedure: detailed fact-finding, credit guide, SOCA",
    "Notes CRM documentation for lender recommendations"
  ],
  
  "missing": [],
  
  "objectiveEvidence": [
    {
      "objectivePart": "Identify specific regulatory change",
      "status": "LIKELY SUFFICIENT",
      "evidence": "A recent regulatory change was the best interest duty legislation"
    },
    {
      "objectivePart": "Explain impact on procedures",
      "status": "LIKELY SUFFICIENT",
      "evidence": "Provide detailed fact-finding, credit guide, and Statement of Credit Assistance"
    },
    {
      "objectivePart": "Describe daily work changes",
      "status": "LIKELY SUFFICIENT",
      "evidence": "Document quantitative and qualitative notes in CRM demonstrating lender selection"
    }
  ],
  
  "hintWouldHelp": false,
  
  "professionalConductConcern": false,
  
  "assessorRationale": "Dikki identified a specific regulatory change, described practical compliance procedures, and explained practical daily work impact.",
  
  "confidence": "high"
}
```

**Learner-Facing Guidance (Generated from above):**

```
Thank you for your responses, Billy. 

You have identified the Best Interest Duty as a recent regulatory change and described 
practical impacts on your work, including detailed fact-finding, credit guides, Statements 
of Credit Assistance, and CRM documentation requirements. 

You have provided sufficient evidence for this question.

Please press the Next Question button to continue.
```

---

## DeepSeek-V4-Flash Prompt (Alternative)

### System Instruction

```
You are an expert Australian financial services RPL assessor and evidence reviewer 
for vocational competency outcomes aligned to FNS50322 Diploma of Finance and Mortgage 
Broking Management, FNS40821 Certificate IV in Finance and Mortgage Broking, and closely 
related Australian finance, lending, and mortgage broking qualifications.

Return valid JSON only.

Do not return Markdown, commentary, explanations, headings, code fences, or learner-facing 
prose outside the required JSON structure.

You are reviewing evidence provided during an RPL interview. Your output is converted 
by application code into warm, balanced learner feedback similar to feedback from an 
experienced vocational assessor.

Your only task is to assess the combined evidence in all learner attempts 
primarily against the supplied objective and question.
```

### Core Philosophy

```
This interview replaces a conversation between the learner and a human assessor. 
The required standard is demonstrated understanding of the topic at the level set 
by the objective, not exhaustive or exam-level detail. The objective always remains 
the minimum requirement.

When the learner has directly met the objective with clear, relevant and role-appropriate 
evidence, return LIKELY SUFFICIENT even if the response is brief, informal, contains 
spelling or grammar errors, or could reasonably include more detail.

Do not mark a response as needing additional evidence merely because a stronger, longer 
or more polished answer could have been provided.
```

### Sufficiency Calibration - Green Lights for LIKELY SUFFICIENT

Return LIKELY SUFFICIENT when:
- Learner addresses every core requirement in the objective
- Response directly relates to the question asked
- Evidence is relevant to the learner's role or industry
- Learner provides enough practical information to identify what occurred, what they did, or how their work was affected
- Evidence is concise but still clear and meaningful
- Learner uses informal workplace language rather than formal regulatory or training terminology
- Answer contains minor spelling, grammar or terminology errors that do not prevent the meaning from being understood
- Not every detail suggested by the hint is present, provided the objective has been met

### Sufficiency Calibration - Red Lights (DO NOT Penalize)

Do NOT return ADDITIONAL EVIDENCE MAY BE NEEDED merely because:

- The answer is short
- Additional detail would make the answer stronger
- The learner did not explicitly use the same wording as the objective
- The learner did not follow every suggestion in the hint
- The learner did not provide an exhaustive explanation
- The learner did not provide multiple examples when one clear example meets the objective
- The learner did not explicitly use phrases such as 'day-to-day impact', 'before and after', 'stakeholder impact' or 'product impact' when the practical meaning is already clear
- Further attempts are still available

### Sufficiency Calibration - Penalize For

Return ADDITIONAL EVIDENCE MAY BE NEEDED only when:

- Core requirement from objective/question not addressed
- Response too vague to determine what learner actually did
- Learner discusses related topic but doesn't answer the question
- Identifies subject but doesn't explain required impact/action/process/outcome/example
- Important statement unclear or unsupported
- Generic claims with no practical role-relevant content
- Conduct inconsistent with professional/ethical practice

### DeepSeek-Specific Rules

1. **Evidence-Aware and Fair**
   - Be evidence-aware and fair, not lenient and not unnecessarily strict
   - Give full credit to relevant evidence clearly contained in the learner's own words
   - Do not invent evidence or infer detailed facts that the learner did not state
   - Reasonable workplace inference is permitted where the practical meaning is clear

2. **Terminology Flexibility**
   - Do not require formal terminology where the learner has clearly described the concept in ordinary workplace language
   - Accept informal abbreviations and workplace jargon if meaning is clear

3. **Partial Credit**
   - For a partly correct answer, return ADDITIONAL EVIDENCE MAY BE NEEDED while still acknowledging all relevant evidence in covered
   - When relevant evidence exists, do not mark the answer harshly

4. **Balanced Language**
   - Prefer balanced wording such as 'some additional detail may be required' over harsh wording
   - Do not use harsh or absolute language in assessorRationale when any relevant evidence exists

### Forbidden Harsh Language

Avoid wording such as:
- "failed to"
- "does not demonstrate"
- "could not identify"
- "insufficient evidence"
- "no evidence"
- "incorrect"

When relevant evidence exists, assessorRationale must briefly acknowledge it before identifying genuine remaining gap.

### Attempt Calibration

1. **Treat attempts as building blocks**
   - All attempts are assessed in combination
   - A later attempt may add evidence that was missing from an earlier attempt
   - The learner has up to 3 attempts to build their complete response
   - Do not ask the learner to repeat evidence they have already provided in a previous attempt

2. **Attempt assessment**
   - Use all attempts combined when assessing status
   - Track which evidence came from which attempt for transcript purposes
   - Credit complete evidence even if spread across multiple attempts

### Hint Safety Rules

1. **Treat hint as directional guidance only**
   - Use the hint to guide expectations about broad coverage and level of detail
   - Never quote, paraphrase, list, or reveal hint content in any returned field
   - The hint is the same content the learner can access with the Show Hint button

2. **Hint support assessment**
   - If the hint would help with a missing part of the response, set hintWouldHelp to true
   - Keep missing generic enough that it does not reveal the hint or a model answer

### Covered Field Rules (Critical Calibration)

Covered items must:
- Contain only evidence the learner has actually provided
- Reflect evidence from all attempts combined
- Use short, neutral evidence points
- Acknowledge the learner's relevant statements without exaggeration
- Avoid assessor judgment such as 'correctly', 'successfully', 'adequately' or 'demonstrates competency'
- Avoid revealing information drawn only from the hint
- Avoid adding regulatory facts, examples or terminology not supplied by the learner
- Exclude any statements describing inappropriate, unprofessional or unethical conduct

Good covered item style:
- "Identifies BID as the regulatory change"
- "Describes more detailed fact-finding"
- "Notes documenting product suitability"
- "States that supporting evidence is stored in the CRM"

Poor covered item style:
- "Correctly explains all BID obligations"
- "Demonstrates a comprehensive understanding"
- "Mentions the required compliance process from the hint"
- "Understands that ASIC requires brokers to..."

### Missing Field Rules

Missing items must be:
- Short noun phrases, not commands
- Where the objective expressly requires them, use phrases like 'one internal stakeholder affected by the change' and 'one external stakeholder affected by the change'
- Never written as 'names an internal stakeholder' or 'explain an external stakeholder'

### Professional Conduct Assessment

- Treat appropriate and professional behaviour as an implicit core requirement of every question
- Do not credit described actions, strategies or attitudes that a competent professional in the learner's role would consider unprofessional, disrespectful, discriminatory, unethical or contrary to the client's best interests
- Set professionalConductConcern to true when any attempt shows disregard for client best interests, ethical duties or legal obligations
- Set it to false otherwise

### Objective Evidence Breakdown Rules

1. **Component Decomposition**
   - Break the objective into its distinct component parts (typically 2 to 5)
   - Return one objectiveEvidence item per part

2. **Part Labeling**
   - objectivePart must be a short neutral label for that part of the objective, 10 words or fewer
   - Each part's status must be LIKELY SUFFICIENT or ADDITIONAL EVIDENCE MAY BE NEEDED

3. **Evidence Quotation**
   - When a part is LIKELY SUFFICIENT, evidence must be a short direct quote or close paraphrase (25 words or fewer) of the learner's own wording that meets that part
   - When a part is ADDITIONAL EVIDENCE MAY BE NEEDED, evidence must be a short quote of any partial learner evidence for that part, or an empty string if none exists
   - Evidence must come only from the learner's attempts. Never place hint content, model answers, or suggested wording in evidence

### Output Length Rules

- covered: at most 3 items, each 12 words or fewer
- missing: at most 3 items, each 12 words or fewer
- assessorRationale: one sentence of 30 words or fewer
- objectiveEvidence: at most 5 parts; each objectivePart 10 words or fewer; each evidence quote 25 words or fewer
- Entire JSON response: under 300 words

### JSON Output Schema

```json
{
  "overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
  
  "covered": [
    "short neutral evidence point (≤12 words)",
    "another covered point",
    "third covered point"
  ],
  
  "missing": [
    "short neutral missing requirement (≤12 words)",
    "another gap if ADDITIONAL EVIDENCE needed"
  ],
  
  "objectiveEvidence": [
    {
      "objectivePart": "component of objective (≤10 words)",
      "status": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
      "evidence": "quote or paraphrase from learner (≤25 words) or empty string"
    }
  ],
  
  "hintWouldHelp": false,
  
  "professionalConductConcern": false,
  
  "assessorRationale": "one sentence, balanced tone, acknowledges evidence before identifying gaps (≤30 words)",
  
  "confidence": "high | medium | low"
}
```

### Example DeepSeek Assessment

**Same question and learner answers as Azure OpenAI example above**

**DeepSeek Response (More Lenient, Evidence-Aware):**

```json
{
  "overallAssessment": "LIKELY SUFFICIENT",
  
  "covered": [
    "Identifies BID legislation as regulatory change",
    "Describes practical procedure changes: fact-finding, credit guide, SOCA",
    "Mentions CRM documentation for lender recommendations"
  ],
  
  "missing": [],
  
  "objectiveEvidence": [
    {
      "objectivePart": "Identify regulatory change",
      "status": "LIKELY SUFFICIENT",
      "evidence": "Best interest duty legislation"
    },
    {
      "objectivePart": "Explain work impact",
      "status": "LIKELY SUFFICIENT",
      "evidence": "More detailed fact-finding, credit guide, Statement of Credit Assistance"
    },
    {
      "objectivePart": "Describe daily work changes",
      "status": "LIKELY SUFFICIENT",
      "evidence": "Document quantitative and qualitative notes in CRM for lender selection"
    }
  ],
  
  "hintWouldHelp": false,
  
  "professionalConductConcern": false,
  
  "assessorRationale": "Dikki identified the regulatory change and described practical work changes demonstrating clear understanding.",
  
  "confidence": "high"
}
```

### Prompt Differences: DeepSeek vs. Azure OpenAI

| Aspect | Azure OpenAI | DeepSeek |
|--------|--------------|----------|
| **Tone** | Formal, assessor-style | Warm, evidence-aware, fair |
| **Strictness** | Standard RPL rigor | Reduced strictness (no false harshness) |
| **Length** | Moderate rules | Emphasizes "not too short" OK |
| **Terminology** | Must align with objective | Accepts informal workplace language |
| **Evidence Credit** | Full if meeting objective | Full + partial credit with acknowledgment |
| **Guidance Focus** | Objective compliance | Practical understanding demonstrated |
| **Inference** | Limited | Reasonable workplace inference allowed |
| **Covered Items** | Neutral, assessor-style | Neutral, learner-achievement style |
| **Missing Items** | Noun phrases | Noun phrases (same) |
| **Language Avoid** | Harsh terms OK if accurate | Forbidden: "failed to", "insufficient" |
| **Use Case** | Strict compliance evaluation | Supportive but fair assessment |

---

## AI Mode Selection

### UI Implementation

In the Welcome screen, users toggle between assessors:

```
┌──────────────────────────────────────┐
│ Assessor:                            │
│                                      │
│ ○ Azure OpenAI  [Toggle Switch]      │
│ ● DeepSeek      ← Currently selected │
│                                      │
└──────────────────────────────────────┘
```

### Technical Implementation

**JavaScript Detection:**
```javascript
const detectDeepseekMode = () => {
  try {
    if (window.useDeepseekMode === true) return true;
    if (localStorage.getItem("rpl_use_deepseek") === "true") return true;
    return false;
  } catch {
    return false;
  }
};
```

**Storage Keys:**
- `window.useDeepseekMode` - Runtime flag
- `localStorage["rpl_use_deepseek"]` - Persistent user preference

**HTML Checkbox Control:**
```html
<label class="aiModeToggle">
  <input type="checkbox" id="deepseekModeToggle" />
  <span class="aiModeToggleKnob"></span>
</label>
<span class="aiModeLabel" id="aiModeLabelDisplay">Azure OpenAI</span>
```

**When Toggle Changes:**
1. Set window.useDeepseekMode
2. Save to localStorage
3. Update UI label display
4. All subsequent Check Response calls use selected mode

### Rate Limiting Protection

**DeepSeek Mode Only:**
```javascript
const applyQuestionCooldown = async () => {
  if (!detectDeepseekMode()) return;
  
  console.log("Rate limit protection: Deepseek mode: 15s cooldown");
  await wait(15000); // 15 seconds
};
```

**Applied After:**
- goNextQuestion() call #1
- goNextQuestion() call #2
- goNextQuestion() call #3

**Purpose:** DeepSeek has strict rate limiting; 15-second cooldown prevents 429 errors

---

## Data Flow: How Answers Become Reports

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CANDIDATE ANSWERS QUESTION                                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ INPUT METHOD:                                                   │
│ ├─ Speech Recognition (Azure Speech SDK v1.41.0)               │
│ │  └─ Microphone input → transcribed to text                   │
│ └─ Text Input                                                   │
│    └─ User types directly in textarea                          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "CHECK RESPONSE"                                   │
│ ├─ Show loading indicator ("Thinking Please Wait")             │
│ └─ Start response timer (0.0s - 20.0s)                        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ BUILD ASSESSMENT PAYLOAD                                        │
│ ├─ Current answer text                                         │
│ ├─ Question text                                               │
│ ├─ Question objective                                          │
│ ├─ Question hint                                               │
│ ├─ All previous attempts on this question                      │
│ ├─ Candidate metadata (industry, job title)                    │
│ ├─ Max attempts (3)                                            │
│ └─ Attempt count (current)                                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ CHOOSE PROMPT & SEND TO AI                                      │
│ ├─ If window.useDeepseekMode === true:                         │
│ │  └─ buildDeepseekAssessmentPrompt(payload)                   │
│ └─ Else:                                                        │
│    └─ buildAssessmentPrompt(payload) [Azure OpenAI]           │
│                                                                 │
│ POST /webhook/checkResponse                                    │
│ ├─ Endpoint: Power Automate                                    │
│ ├─ Timeout: 20 seconds                                         │
│ └─ Response: JSON assessment                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ RECEIVE AI ASSESSMENT JSON                                      │
│ {                                                               │
│   "overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL...",    │
│   "covered": [...],                                            │
│   "missing": [...],                                            │
│   "objectiveEvidence": [...],                                  │
│   "assessorRationale": "...",                                  │
│   "confidence": "high|medium|low"                              │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ CONVERT TO LEARNER-FACING GUIDANCE                              │
│ ├─ Remove assessment labels (objectives, preliminary status)   │
│ ├─ Convert 3rd person to "you" language                        │
│ ├─ Replace "Objective" with "question requirements"           │
│ ├─ Add "please press Next Question button" if SUFFICIENT      │
│ └─ Store in transcript for reporting                          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ DISPLAY IN UI                                                   │
│ ├─ Show guidance text in "Guidance" window                      │
│ ├─ Hide loading indicator                                      │
│ ├─ Stop response timer                                         │
│ ├─ Store in chatHistory (DOM)                                  │
│ └─ Append to fullTranscript (text)                            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ DECISION LOGIC                                                  │
│ ├─ Parse: overallAssessment === "LIKELY SUFFICIENT"?           │
│ ├─ If YES:                                                      │
│ │  └─ Enable "Next Question" button                            │
│ ├─ If NO:                                                       │
│ │  ├─ If attempts < 3:                                        │
│ │  │  └─ Re-enable textarea for retry                         │
│ │  └─ Else:                                                    │
│ │     └─ Enable "Next Question" button                        │
│ └─ In all cases: disable "Check Response" button               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ CANDIDATE CHOOSES ACTION                                        │
│ ├─ Option A: Retry (if < 3 attempts & status needs more)      │
│ │  └─ Go back to answer input, clear textarea, allow next     │
│ └─ Option B: Continue                                          │
│    └─ Click "Next Question" button                            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LOAD NEXT QUESTION                                              │
│ ├─ POST /webhook/questions                                     │
│ ├─ Receive: next question metadata                             │
│ ├─ Display question + objective + hint                         │
│ ├─ Clear textarea                                              │
│ ├─ Reset attempt counter                                       │
│ └─ Apply 15s cooldown if DeepSeek mode                        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
           [LOOP UNTIL ALL QUESTIONS COMPLETE]
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ FINAL QUESTION ANSWERED                                         │
│ ├─ Show "Finalising" overlay                                    │
│ ├─ Disable all question/answer buttons                         │
│ └─ Background: Generate reports                                │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ GENERATE TRANSCRIPTS                                            │
│ ├─ buildFullTranscript()                                        │
│ │  └─ Text transcript with Q&A + AI feedback                   │
│ └─ buildFullTranscriptJson()                                    │
│    └─ JSON structured data for database                        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ GENERATE PRELIMINARY REVIEW REPORT                              │
│ ├─ buildPreliminaryReviewReport()                               │
│ ├─ For each question:                                           │
│ │  ├─ Extract AI assessor summary                             │
│ │  ├─ Format with line breaks ("Objective evidence:")         │
│ │  ├─ Create question block with attempts/feedback            │
│ │  └─ Compile assessment status                               │
│ ├─ Build HTML report                                           │
│ ├─ Apply CSS styling                                           │
│ └─ Generate PDF-printable format                              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ SEND TO POWER AUTOMATE                                          │
│ ├─ POST /webhook/finalReport                                   │
│ ├─ Payload: candidate info + HTML report                       │
│ ├─ Webhook triggers:                                           │
│ │  ├─ Save to SharePoint                                       │
│ │  ├─ Send to assessor                                         │
│ │  ├─ Create record in Dataverse                              │
│ │  └─ Send confirmation email                                 │
│ └─ Response: success/error status                              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ DISPLAY COMPLETION SCREEN                                       │
│ ├─ Hide "Finalising" overlay                                    │
│ ├─ Show completion screen:                                      │
│ │  "Thank you [Name]. Your responses have been submitted."    │
│ │  "A qualified assessor will review your evidence..."        │
│ ├─ Candidate can:                                              │
│ │  ├─ Close window                                            │
│ │  ├─ View preliminary report (optional)                      │
│ │  └─ Download transcript                                      │
│ └─ Assessment complete                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Components

### Core JavaScript Modules

#### **1. rpl-assessor-decision.js**
- **Purpose:** AI Assessment Logic
- **Key Functions:**
  - `buildAssessmentPrompt()` - Constructs Azure OpenAI system prompt
  - `buildDeepseekAssessmentPrompt()` - Constructs DeepSeek system prompt
  - `parseAssessmentResponse()` - Parses AI JSON response
  - `buildAssessmentPayload()` - Creates payload for AI API calls

#### **2. rpl-preliminary-review.js**
- **Purpose:** Report Generation and Formatting
- **Key Functions:**
  - `rewriteAssessorSummaryForReport()` - Formats AI summaries with line breaks
  - `buildHtmlReport()` - Generates HTML for report display
  - `parseTranscriptQuestions()` - Extracts question blocks from text transcript
  - `formatQuestion()` - Styles individual question sections

#### **3. rpl-final-report-generator.js**
- **Purpose:** End-to-End Report Orchestration
- **Key Functions:**
  - `buildPreliminaryReviewReport()` - Orchestrates full report generation
  - `batchQuestionAnalysis()` - Processes multiple questions for analysis
  - `applyTemplate()` - Applies template substitution

#### **4. rpl-q3-auto-tester-runtime.js (v1.9)**
- **Purpose:** Automation Framework (for testing)
- **Key Functions:**
  - `submitAttempt()` - Automates answer submission
  - `goNextQuestion()` - Advances to next question
  - `runAutoTest()` - Main automation loop
  - `detectDeepseekMode()` - Detects AI model selection

### Azure Services Integration

| Service | Purpose | Usage |
|---------|---------|-------|
| **Azure Speech SDK v1.41.0** | Speech-to-text transcription | Microphone input capture, real-time transcription |
| **Azure OpenAI API** | Primary AI assessment model | Question evaluation, guidance generation |
| **Power Automate Webhooks** | Backend integration | Question fetching, transcript storage, report delivery |
| **Azure App Service** | Web hosting | Public HTML/JS files, runtime execution |

### Power Automate Webhook Endpoints (23 Total)

| Endpoint | Purpose |
|----------|---------|
| `questions` | Fetch next question in sequence |
| `welcome` | Send welcome/initialization data |
| `resume` | Retrieve previous session state |
| `reset` | Clear session and restart |
| `transcript` | Save text transcript |
| `nextQuestion` | Signal question advancement |
| `currentAttempt` | Record current attempt state |
| `transcriptBackup` | Backup transcript to secure storage |
| `recordingUpload` | Upload audio recordings |
| `finalReport` | Send completed report to assessor |
| `assessorQuestions` | Fetch assessor-only questions |
| `photoSaver` | Store candidate photos |
| `checkAssessmentStarted` | Verify assessment has begun |
| `createUserFolder` | Initialize user data directory |
| `assessmentCompleted` | Mark assessment as complete |
| ... | (10 more specialized webhooks) |

---

## Prompt Comparison Analysis

### Calibration Differences

#### **Azure OpenAI (Strict Compliance Mode)**

**Philosophy:** "The objective is the minimum requirement, strictly assessed"

**Approach:**
- Evaluate against objective word-for-word
- Require evidence to meet all specified components
- Apply formal compliance criteria
- Accept no shortcuts or informal equivalents

**When to Use:**
- Regulatory compliance questions requiring precise terminology
- High-stakes credentials (Diploma level)
- Audit-trail documentation where precision matters

**Strengths:**
- Consistent with formal RPL standards
- Defensible to regulators/auditors
- Clear pass/fail criteria
- Good for compliance-heavy content

**Weaknesses:**
- May be overly strict for informal evidence
- Penalizes brevity unnecessarily
- Can feel harsh to candidates
- Risk of rejecting valid informal evidence

#### **DeepSeek-V4-Flash (Evidence-Aware Mode)**

**Philosophy:** "If evidence meets the objective, credit it fairly, even if brief or informal"

**Approach:**
- Evaluate against objective with flexibility
- Accept informal equivalents if meaning is clear
- Recognize workplace evidence as valid
- Avoid false harshness

**When to Use:**
- Practical competency assessment (Certificate level)
- Interview-based evidence collection
- Supportive assessment environment
- Candidates with limited formal training background

**Strengths:**
- Recognizes practical competency
- More encouraging to candidates
- Reflects real-world workplace knowledge
- Reduces candidate frustration

**Weaknesses:**
- May be too lenient for strict compliance
- Harder to defend in disputes
- Less consistent with formal RPL norms
- Risk of over-crediting weak evidence

### When to Switch Modes

**Use Azure OpenAI for:**
- FNS50322 (Diploma) assessments
- Regulatory/compliance questions
- High-stakes credentials
- Audit-critical evidence
- Formal terminology required

**Use DeepSeek for:**
- FNS40821 (Certificate IV) assessments
- Practical competency questions
- Supportive/encouraging assessment
- Workplace-based evidence
- Interview-format collection

---

## Implementation Details

### Boot Gate: JSON Upload Validation (v1.9)

**File:** `AAMC RPL 2026 Q3 Auto Tester.html`

**Purpose:** Enforce JSON file upload before assessment entry

**Flow:**
```
1. User selects JSON file (transcript with answers)
2. File parsed and validated (questions array required)
3. Answers table generated (DOM-safe with insertRow/insertCell)
4. User reviews answer count
5. Click "Open Auto Tester Page"
6. JSON stored in sessionStorage["rpl_auto_tester_uploaded_json"]
7. Navigate to assessment page with autoTester=1, autoTesterVersion=1.9
```

### Runtime Injection (v1.9)

**File:** `rpl-q3-auto-tester-runtime.js`

**Injection:** Static script tag in footer with cache-busting
```html
<script src="rpl-q3-auto-tester-runtime.js?v=1.9"></script>
```

**Activation:** Automatic on page load
```javascript
if (shouldActivate()) {
  init(); // Initialize automation framework
}
```

### Question Attempt Pattern

**Answer Submission Order (Critical):**
1. Set textarea.value = answerText
2. Dispatch input event with {bubbles: true}
3. Button auto-enables on input event
4. Click button
5. Wait for AI response

**Error Pattern (Fixed in v1.9):**
- ❌ WRONG: Wait for button enable BEFORE setting text (deadlock)
- ✅ CORRECT: Set text FIRST, then wait for button enable (immediate)

### Assessment Payload Structure

```javascript
const payload = {
  // Candidate Context
  candidateMetadata: {
    fullName: "Billy Broker",
    givenName: "Billy",
    contactId: "123456",
    industry: "Mortgage Broking",
    jobTitle: "Mortgage Broker",
    managedStaff: false
  },
  
  // Question Content
  question: {
    number: 1,
    text: "Identify a recent regulatory change...",
    objective: "Identify change, explain impact...",
    hint: "Consider RG209, BID..."
  },
  
  // Candidate Responses (All Attempts)
  attempts: [
    { attemptNumber: 1, responseText: "..." },
    { attemptNumber: 2, responseText: "..." }
  ],
  
  // Assessment Parameters
  attemptCount: 2,
  maxAttempts: 3,
  
  // Mode Selection
  useDeepseek: false // or true
};
```

### Response Formatting

**From AI Assessment JSON:**
```json
{
  "overallAssessment": "LIKELY SUFFICIENT",
  "assessorRationale": "Dikki identified specific change, described practical impact..."
}
```

**To Learner-Facing Guidance:**
```
Thank you for your responses, Billy. 

[Converted to "you" language, objective references removed]

You have identified the Best Interest Duty as a recent change and described 
practical workplace impacts...

You have provided sufficient evidence for this question.

Please press the Next Question button to continue.
```

---

## Troubleshooting & Common Scenarios

### Scenario 1: DeepSeek 429 Rate Limit Errors

**Problem:** "Your requests to DeepSeek-V4-Flash have exceeded rate limit"

**Solution Applied (v1.9):**
- Detect DeepSeek mode via `detectDeepseekMode()`
- Apply 15-second cooldown after each question advancement
- Logged in console: "Rate limit protection: Deepseek mode: 15s cooldown"

### Scenario 2: Azure OpenAI Timeout (Next Question Not Advancing)

**Problem:** "Next Question button did not advance to new question after 120 seconds"

**Solution Applied (v1.9):**
- Add 500ms delay after button click to allow DOM processing
- Improved error messages showing actual question numbers
- Code: `nextBtn.click(); await wait(500); await waitFor(...)`

### Scenario 3: Attempt Text Contains "Attempt N:" Prefix

**Problem:** Submitted answers include labels like "Attempt 1: The answer"

**Solution Applied (v1.9):**
- Strip attempt prefixes with regex: `/^attempt\s*\d+\s*(?:\([^)]*\))?\s*[:\-–—.]?\s*/i`
- Applied before submission to AI

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| **v1.9** | 2026-07-23 | Boot gate validation, runtime injection, DeepSeek rate limiting, attempt prefix stripping, line break formatting in reports |
| v1.8 | 2026-07-20 | Azure OpenAI timeout fixes, Next Question state monitoring |
| v1.7 | 2026-07-18 | DeepSeek mode implementation, prompt tuning |
| v1.6 | 2026-07-15 | Report formatting improvements |
| v1.5 | 2026-07-10 | Initial multi-AI support |

---

## Summary

The AAMC RPL 2026 Q3 system is a sophisticated **AI-powered vocational assessment engine** that:

1. **Collects Evidence** via speech recognition and text input
2. **Assesses Competency** using either Azure OpenAI (strict compliance) or DeepSeek (evidence-aware, fair) AI models
3. **Provides Feedback** in learner-friendly language with guided refinement up to 3 attempts
4. **Generates Reports** with comprehensive formatting suitable for qualified assessor review
5. **Maintains Audit Trails** for all responses, attempts, and AI assessments

The dual-prompt architecture allows organizations to choose between strict compliance assessment (Azure OpenAI) or more supportive, fair-minded evaluation (DeepSeek) based on assessment context and candidate needs.

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-23  
**Suitable For:** ChatGPT Analysis, Technical Documentation, Assessor Training
