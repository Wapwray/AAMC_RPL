export type RplRecord = Record<string, unknown>;

export type CtMatchRuleType = "startsWith" | "equals" | "prefix" | "regex";

export interface CtMatchConfig {
  type?: CtMatchRuleType;
  value?: string;
  flags?: string;
}

export type QuestionRuleOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "exists"
  | "missing"
  | "regex"
  | "always"
  | "never";

export interface QuestionRuleConfig {
  field?: string;
  operator?: QuestionRuleOperator;
  value?: unknown;
  caseSensitive?: boolean;
  regexFlags?: string;
}

export interface OutputSelectionConfig {
  mode?: "all" | "selected";
  fields?: string[];
}

export interface DiagnosticsConfig {
  includeExcludedQuestions?: boolean;
  includeExcludedByUnitCodes?: boolean;
  includeCounts?: boolean;
  includeWarnings?: boolean;
}

export interface RplFilterConfig {
  unitStatusFieldCandidates?: string[];
  unitCodeFieldCandidates?: string[];
  ctMatch?: CtMatchConfig;
  exclusionFields?: string[];
  exclusionDelimiters?: string[];
  trimExclusionValues?: boolean;
  caseSensitive?: boolean;
  normalizeUnitCodes?: boolean;
  unitCodeCase?: "upper" | "lower" | "preserve";
  questionLiveField?: string;
  studentRule?: QuestionRuleConfig;
  assessorRule?: QuestionRuleConfig;
  output?: OutputSelectionConfig;
  outputFields?: string[];
  diagnostics?: DiagnosticsConfig;
  managedStaffField?: string;
}

export interface RplFilterInput {
  units: RplRecord[];
  questions: RplRecord[];
  managedStaff?: boolean | "Yes" | "No";
  config?: RplFilterConfig;
}

export interface RplFilterCounts {
  unitsReceived: number;
  ctUnitsFound: number;
  unitCodes: number;
  questionsReceived: number;
  questionsIncluded: number;
  questionsExcluded: number;
  studentQuestions: number;
  assessorQuestions: number;
  managedStaffQuestionsFiltered: number;
}

export interface ExcludedByDiagnostic {
  questionIndex: number;
  fields: string[];
  unitCodes: string[];
}

export interface MissingFieldDiagnostics {
  unitStatus: number;
  unitCode: number;
  questionExclusionFields: Record<string, number>;
  questionRuleFields: Record<string, number>;
  outputFields: Record<string, number>;
}

export interface RplDiagnostics {
  excludedBy?: ExcludedByDiagnostic[];
  excludedQuestionIndexes?: number[];
  missingFields: MissingFieldDiagnostics;
  unclassifiedQuestionIndexes: number[];
  dualMatchedQuestionIndexes: number[];
  counts?: RplFilterCounts;
  warnings?: string[];
  resolvedConfig: {
    unitStatusFieldCandidates: string[];
    unitCodeFieldCandidates: string[];
    ctMatch: Required<CtMatchConfig>;
    exclusionFields: string[];
    exclusionDelimiters: string[];
    caseSensitive: boolean;
    questionLiveField: string;
    output: Required<OutputSelectionConfig>;
    managedStaffField: string;
    managedStaffEnabled: boolean;
  };
}

export interface RplFilterResponse {
  success: true;
  unitCodes: string[];
  studentQuestions: RplRecord[];
  assessorQuestions: RplRecord[];
  includedQuestions: RplRecord[];
  excludedQuestions: RplRecord[];
  counts: RplFilterCounts;
  warnings: string[];
  diagnostics: RplDiagnostics;
}

interface ResolvedQuestionRule {
  field: string;
  operator: QuestionRuleOperator;
  value: string;
  caseSensitive: boolean;
  regexFlags: string;
}

interface ResolvedFilterConfig {
  unitStatusFieldCandidates: string[];
  unitCodeFieldCandidates: string[];
  ctMatch: Required<CtMatchConfig>;
  exclusionFields: string[];
  exclusionDelimiters: string[];
  trimExclusionValues: boolean;
  caseSensitive: boolean;
  normalizeUnitCodes: boolean;
  unitCodeCase: "upper" | "lower" | "preserve";
  questionLiveField: string;
  studentRule: ResolvedQuestionRule;
  assessorRule: ResolvedQuestionRule;
  output: Required<OutputSelectionConfig>;
  diagnostics: Required<DiagnosticsConfig>;
  managedStaffField: string;
  managedStaffEnabled: boolean;
}

interface FieldLookup {
  found: boolean;
  key?: string;
  value?: unknown;
}

const DEFAULT_UNIT_STATUS_FIELDS = ["STATUS", "Status", "status", "Unit Status", "unitStatus", "UnitStatus"];
const DEFAULT_UNIT_CODE_FIELDS = ["CODE", "Code", "code", "Unit Code", "unitCode", "UnitCode"];
const DEFAULT_EXCLUSION_FIELDS = ["CT Do Not Ask 1"];
const DEFAULT_QUESTION_LIVE_FIELD = "Question Live";
const DEFAULT_MANAGED_STAFF_FIELD = "Managed Staff";

const VALID_RULE_OPERATORS: QuestionRuleOperator[] = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "exists",
  "missing",
  "regex",
  "always",
  "never",
];

export function filterRplQuestions(input: RplFilterInput, configOverride?: RplFilterConfig): RplFilterResponse {
  const config = resolveConfig(input.config, configOverride, input.managedStaff);
  const warnings: string[] = [];
  const missingFields: MissingFieldDiagnostics = {
    unitStatus: 0,
    unitCode: 0,
    questionExclusionFields: {},
    questionRuleFields: {},
    outputFields: {},
  };
  const units = Array.isArray(input.units) ? input.units : [];
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const unitCodeSet = new Set<string>();
  let ctUnitsFound = 0;

  units.forEach((unit) => {
    const unitRecord = asRecord(unit);
    const statusLookup = resolveField(unitRecord, config.unitStatusFieldCandidates);
    if (!statusLookup.found) {
      missingFields.unitStatus += 1;
      return;
    }

    if (!matchesCtStatus(toText(statusLookup.value), config, warnings)) {
      return;
    }

    ctUnitsFound += 1;
    const codeLookup = resolveField(unitRecord, config.unitCodeFieldCandidates);
    if (!codeLookup.found) {
      missingFields.unitCode += 1;
      return;
    }

    const unitCode = normalizeUnitCode(toText(codeLookup.value), config);
    if (unitCode) {
      unitCodeSet.add(unitCode);
    } else {
      missingFields.unitCode += 1;
    }
  });

  const unitCodes = Array.from(unitCodeSet);
  const includedQuestions: RplRecord[] = [];
  const excludedQuestions: RplRecord[] = [];
  const studentQuestions: RplRecord[] = [];
  const assessorQuestions: RplRecord[] = [];
  const excludedBy: ExcludedByDiagnostic[] = [];
  const unclassifiedQuestionIndexes: number[] = [];
  const dualMatchedQuestionIndexes: number[] = [];
  let managedStaffQuestionsFiltered = 0;

  questions.forEach((question, questionIndex) => {
    const questionRecord = asRecord(question);
    const exclusionMatch = getQuestionExclusionMatch(questionRecord, questionIndex, unitCodeSet, config, missingFields);
    const projectedQuestion = projectQuestion(questionRecord, config, missingFields);

    if (exclusionMatch.unitCodes.length) {
      excludedQuestions.push(projectedQuestion);
      excludedBy.push(exclusionMatch);
      return;
    }

    // Exclude managed-staff questions when the caller has not enabled them
    if (!config.managedStaffEnabled) {
      const msLookup = resolveField(questionRecord, [config.managedStaffField]);
      if (msLookup.found && toText(msLookup.value).trim().toLowerCase() === "yes") {
        managedStaffQuestionsFiltered += 1;
        excludedQuestions.push(projectedQuestion);
        return;
      }
    }

    includedQuestions.push(projectedQuestion);
    const isStudentQuestion = evaluateQuestionRule(questionRecord, config.studentRule, missingFields, warnings);
    const isAssessorQuestion = evaluateQuestionRule(questionRecord, config.assessorRule, missingFields, warnings);

    if (isStudentQuestion) {
      studentQuestions.push(projectedQuestion);
    }
    if (isAssessorQuestion) {
      assessorQuestions.push(projectedQuestion);
    }
    if (!isStudentQuestion && !isAssessorQuestion) {
      unclassifiedQuestionIndexes.push(questionIndex);
    }
    if (isStudentQuestion && isAssessorQuestion) {
      dualMatchedQuestionIndexes.push(questionIndex);
    }
  });

  const counts: RplFilterCounts = {
    unitsReceived: units.length,
    ctUnitsFound,
    unitCodes: unitCodes.length,
    questionsReceived: questions.length,
    questionsIncluded: includedQuestions.length,
    questionsExcluded: excludedQuestions.length,
    studentQuestions: studentQuestions.length,
    assessorQuestions: assessorQuestions.length,
    managedStaffQuestionsFiltered,
  };

  addSummaryWarnings(warnings, missingFields, counts, config, unclassifiedQuestionIndexes, dualMatchedQuestionIndexes);

  const diagnostics: RplDiagnostics = {
    missingFields,
    unclassifiedQuestionIndexes,
    dualMatchedQuestionIndexes,
    resolvedConfig: {
      unitStatusFieldCandidates: config.unitStatusFieldCandidates,
      unitCodeFieldCandidates: config.unitCodeFieldCandidates,
      ctMatch: config.ctMatch,
      exclusionFields: config.exclusionFields,
      exclusionDelimiters: config.exclusionDelimiters,
      caseSensitive: config.caseSensitive,
      questionLiveField: config.questionLiveField,
      output: config.output,
      managedStaffField: config.managedStaffField,
      managedStaffEnabled: config.managedStaffEnabled,
    },
  };

  if (config.diagnostics.includeExcludedByUnitCodes) {
    diagnostics.excludedBy = excludedBy;
  }
  if (config.diagnostics.includeExcludedQuestions) {
    diagnostics.excludedQuestionIndexes = excludedBy.map((item) => item.questionIndex);
  }
  if (config.diagnostics.includeCounts) {
    diagnostics.counts = counts;
  }
  if (config.diagnostics.includeWarnings) {
    diagnostics.warnings = warnings;
  }

  return {
    success: true,
    unitCodes,
    studentQuestions,
    assessorQuestions,
    includedQuestions,
    excludedQuestions,
    counts,
    warnings,
    diagnostics,
  };
}

function resolveConfig(inputConfig?: RplFilterConfig, overrideConfig?: RplFilterConfig): ResolvedFilterConfig {
function resolveConfig(inputConfig?: RplFilterConfig, overrideConfig?: RplFilterConfig, managedStaff?: boolean | "Yes" | "No"): ResolvedFilterConfig {
  const merged = mergeFilterConfig(inputConfig, overrideConfig);
  const questionLiveField = cleanString(merged.questionLiveField) || DEFAULT_QUESTION_LIVE_FIELD;
  const caseSensitive = typeof merged.caseSensitive === "boolean" ? merged.caseSensitive : false;
  const explicitUnitCodeCase = merged.unitCodeCase;
  const unitCodeCase = explicitUnitCodeCase || (caseSensitive ? "preserve" : "upper");
  const outputFields = cleanStringArray(merged.outputFields, []);
  const outputConfig = merged.output || {};
  const outputMode = outputConfig.mode === "selected" || outputFields.length ? "selected" : "all";

  return {
    unitStatusFieldCandidates: cleanStringArray(merged.unitStatusFieldCandidates, DEFAULT_UNIT_STATUS_FIELDS),
    unitCodeFieldCandidates: cleanStringArray(merged.unitCodeFieldCandidates, DEFAULT_UNIT_CODE_FIELDS),
    ctMatch: resolveCtMatch(merged.ctMatch),
    exclusionFields: cleanStringArray(merged.exclusionFields, DEFAULT_EXCLUSION_FIELDS),
    exclusionDelimiters: resolveDelimiters(merged.exclusionDelimiters),
    trimExclusionValues: typeof merged.trimExclusionValues === "boolean" ? merged.trimExclusionValues : true,
    caseSensitive,
    normalizeUnitCodes: typeof merged.normalizeUnitCodes === "boolean" ? merged.normalizeUnitCodes : true,
    unitCodeCase,
    questionLiveField,
    studentRule: resolveQuestionRule(merged.studentRule, {
      field: questionLiveField,
      operator: "equals",
      value: "Yes",
      caseSensitive,
      regexFlags: caseSensitive ? "" : "i",
    }),
    assessorRule: resolveQuestionRule(merged.assessorRule, {
      field: questionLiveField,
      operator: "notEquals",
      value: "Yes",
      caseSensitive,
      regexFlags: caseSensitive ? "" : "i",
    }),
    output: {
      mode: outputMode,
      fields: cleanStringArray(outputConfig.fields, outputFields),
    },
    diagnostics: {
      includeExcludedQuestions: merged.diagnostics?.includeExcludedQuestions !== false,
      includeExcludedByUnitCodes: merged.diagnostics?.includeExcludedByUnitCodes !== false,
      includeCounts: merged.diagnostics?.includeCounts !== false,
      includeWarnings: merged.diagnostics?.includeWarnings !== false,
    },
    managedStaffField: cleanString(merged.managedStaffField) || DEFAULT_MANAGED_STAFF_FIELD,
    managedStaffEnabled: resolveManagedStaffFlag(managedStaff),
  };
}

function mergeFilterConfig(inputConfig?: RplFilterConfig, overrideConfig?: RplFilterConfig): RplFilterConfig {
  const first = inputConfig || {};
  const second = overrideConfig || {};
  return {
    ...first,
    ...second,
    ctMatch: {
      ...(first.ctMatch || {}),
      ...(second.ctMatch || {}),
    },
    output: {
      ...(first.output || {}),
      ...(second.output || {}),
    },
    diagnostics: {
      ...(first.diagnostics || {}),
      ...(second.diagnostics || {}),
    },
    studentRule: {
      ...(first.studentRule || {}),
      ...(second.studentRule || {}),
    },
    assessorRule: {
      ...(first.assessorRule || {}),
      ...(second.assessorRule || {}),
    },
  };
}

function resolveCtMatch(config?: CtMatchConfig): Required<CtMatchConfig> {
  const type = config?.type === "equals" || config?.type === "prefix" || config?.type === "regex" ? config.type : "startsWith";
  return {
    type,
    value: cleanString(config?.value) || "CT",
    flags: cleanString(config?.flags),
  };
}

function resolveQuestionRule(config: QuestionRuleConfig | undefined, fallback: ResolvedQuestionRule): ResolvedQuestionRule {
  const operator = config?.operator && VALID_RULE_OPERATORS.includes(config.operator) ? config.operator : fallback.operator;
  const caseSensitive = typeof config?.caseSensitive === "boolean" ? config.caseSensitive : fallback.caseSensitive;
  return {
    field: cleanString(config?.field) || fallback.field,
    operator,
    value: config && Object.prototype.hasOwnProperty.call(config, "value") ? toText(config.value) : fallback.value,
    caseSensitive,
    regexFlags: cleanString(config?.regexFlags) || (caseSensitive ? "" : "i"),
  };
}

function resolveDelimiters(value?: string[]): string[] {
  const delimiters = cleanStringArray(value, [","]).map((delimiter) => {
    const normalized = delimiter.toLowerCase();
    if (normalized === "comma") return ",";
    if (normalized === "semicolon") return ";";
    if (normalized === "newline" || normalized === "\\n") return "\n";
    if (normalized === "pipe") return "|";
    return delimiter;
  });
  return delimiters.length ? delimiters : [","];
}

function getQuestionExclusionMatch(
  question: RplRecord,
  questionIndex: number,
  unitCodeSet: Set<string>,
  config: ResolvedFilterConfig,
  missingFields: MissingFieldDiagnostics
): ExcludedByDiagnostic {
  const matchedFields = new Set<string>();
  const matchedUnitCodes = new Set<string>();

  if (!unitCodeSet.size) {
    return { questionIndex, fields: [], unitCodes: [] };
  }

  config.exclusionFields.forEach((field) => {
    const lookup = resolveField(question, [field]);
    if (!lookup.found) {
      incrementCounter(missingFields.questionExclusionFields, field);
      return;
    }

    splitExclusionValues(toText(lookup.value), config).forEach((rawCode) => {
      const unitCode = normalizeUnitCode(rawCode, config);
      if (unitCode && unitCodeSet.has(unitCode)) {
        matchedFields.add(lookup.key || field);
        matchedUnitCodes.add(unitCode);
      }
    });
  });

  return {
    questionIndex,
    fields: Array.from(matchedFields),
    unitCodes: Array.from(matchedUnitCodes),
  };
}

function evaluateQuestionRule(
  question: RplRecord,
  rule: ResolvedQuestionRule,
  missingFields: MissingFieldDiagnostics,
  warnings: string[]
): boolean {
  if (rule.operator === "always") return true;
  if (rule.operator === "never") return false;

  const lookup = resolveField(question, [rule.field]);
  if (!lookup.found) {
    incrementCounter(missingFields.questionRuleFields, rule.field);
  }

  const actual = toText(lookup.value);
  const expected = rule.value;
  const comparableActual = normalizeForComparison(actual, rule.caseSensitive);
  const comparableExpected = normalizeForComparison(expected, rule.caseSensitive);

  switch (rule.operator) {
    case "equals":
      return comparableActual === comparableExpected;
    case "notEquals":
      return comparableActual !== comparableExpected;
    case "contains":
      return comparableActual.includes(comparableExpected);
    case "notContains":
      return !comparableActual.includes(comparableExpected);
    case "startsWith":
      return comparableActual.startsWith(comparableExpected);
    case "endsWith":
      return comparableActual.endsWith(comparableExpected);
    case "exists":
      return lookup.found && actual.trim().length > 0;
    case "missing":
      return !lookup.found || actual.trim().length === 0;
    case "regex":
      return testRegex(expected, actual, rule.regexFlags, warnings, `question rule field ${rule.field}`);
    default:
      return false;
  }
}

function matchesCtStatus(statusValue: string, config: ResolvedFilterConfig, warnings: string[]): boolean {
  const expected = config.ctMatch.value;
  const actual = normalizeForComparison(statusValue, config.caseSensitive);
  const comparableExpected = normalizeForComparison(expected, config.caseSensitive);

  if (config.ctMatch.type === "regex") {
    const flags = config.ctMatch.flags || (config.caseSensitive ? "" : "i");
    return testRegex(expected, statusValue, flags, warnings, "CT status rule");
  }

  if (config.ctMatch.type === "equals") {
    return actual === comparableExpected;
  }

  return actual.startsWith(comparableExpected);
}

function testRegex(pattern: string, value: string, flags: string, warnings: string[], label: string): boolean {
  try {
    return new RegExp(pattern, flags).test(value);
  } catch (error) {
    addUniqueWarning(warnings, `Invalid regex for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function projectQuestion(question: RplRecord, config: ResolvedFilterConfig, missingFields: MissingFieldDiagnostics): RplRecord {
  if (config.output.mode !== "selected" || !config.output.fields.length) {
    return question;
  }

  return config.output.fields.reduce<RplRecord>((projected, field) => {
    const lookup = resolveField(question, [field]);
    if (lookup.found) {
      projected[field] = lookup.value;
    } else {
      projected[field] = "";
      incrementCounter(missingFields.outputFields, field);
    }
    return projected;
  }, {});
}

function splitExclusionValues(value: string, config: ResolvedFilterConfig): string[] {
  if (!value) return [];
  const delimiterPattern = config.exclusionDelimiters
    .map((delimiter) => (delimiter === "\n" ? "\\r?\\n" : escapeRegExp(delimiter)))
    .join("|");
  const splitter = new RegExp(delimiterPattern);
  return value
    .split(splitter)
    .map((part) => (config.trimExclusionValues ? part.trim() : part))
    .filter((part) => part.length > 0);
}

function normalizeUnitCode(value: string, config: ResolvedFilterConfig): string {
  const trimmed = value.trim();
  if (!config.normalizeUnitCodes) return trimmed;
  if (config.unitCodeCase === "upper") return trimmed.toUpperCase();
  if (config.unitCodeCase === "lower") return trimmed.toLowerCase();
  return trimmed;
}

function resolveField(record: RplRecord, candidates: string[]): FieldLookup {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, candidate)) {
      return { found: true, key: candidate, value: record[candidate] };
    }
  }

  const normalizedCandidates = new Set(candidates.map(normalizeFieldName));
  for (const key of Object.keys(record)) {
    if (normalizedCandidates.has(normalizeFieldName(key))) {
      return { found: true, key, value: record[key] };
    }
  }

  return { found: false };
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[\s_\-]/g, "");
}

function normalizeForComparison(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value.trim() : value.trim().toUpperCase();
}

function toText(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(",");
  if (isRecord(value)) {
    const preferredKeys = ["Value", "value", "Title", "title", "Name", "name", "Label", "label"];
    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        return toText(value[key]);
      }
    }
    try {
      return JSON.stringify(value) || "";
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function asRecord(value: unknown): RplRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is RplRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback.slice();
  const cleaned = value.map((item) => toText(item).trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback.slice();
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] || 0) + 1;
}

function addSummaryWarnings(
  warnings: string[],
  missingFields: MissingFieldDiagnostics,
  counts: RplFilterCounts,
  config: ResolvedFilterConfig,
  unclassifiedQuestionIndexes: number[],
  dualMatchedQuestionIndexes: number[]
): void {
  if (missingFields.unitStatus) {
    warnings.push(`${missingFields.unitStatus} unit record(s) were missing a status field. Checked: ${config.unitStatusFieldCandidates.join(", ")}.`);
  }
  if (missingFields.unitCode) {
    warnings.push(`${missingFields.unitCode} CT unit record(s) were missing a unit code field or had a blank unit code. Checked: ${config.unitCodeFieldCandidates.join(", ")}.`);
  }
  Object.entries(missingFields.questionExclusionFields).forEach(([field, count]) => {
    warnings.push(`${count} question record(s) were missing exclusion field "${field}".`);
  });
  Object.entries(missingFields.questionRuleFields).forEach(([field, count]) => {
    warnings.push(`${count} included question record(s) were missing rule field "${field}".`);
  });
  Object.entries(missingFields.outputFields).forEach(([field, count]) => {
    warnings.push(`${count} output record(s) were missing selected output field "${field}".`);
  });
  if (counts.ctUnitsFound === 0) {
    warnings.push("No CT units were found; no unit-code exclusions were applied.");
  } else if (counts.unitCodes === 0) {
    warnings.push("CT units were found, but no CT unit codes could be extracted; no unit-code exclusions were applied.");
  }
  if (unclassifiedQuestionIndexes.length) {
    warnings.push(`${unclassifiedQuestionIndexes.length} included question(s) did not match the student or assessor rule.`);
  }
  if (dualMatchedQuestionIndexes.length) {
    warnings.push(`${dualMatchedQuestionIndexes.length} included question(s) matched both the student and assessor rules.`);
  }
}

function addUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveManagedStaffFlag(value?: boolean | "Yes" | "No"): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "yes";
  return false;
}