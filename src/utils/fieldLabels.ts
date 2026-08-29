// Maps internal project field keys to the label keys stored in app_settings,
// so renaming a field in General Settings propagates everywhere in the product.
export const FIELD_LABEL_KEYS: Record<string, string> = {
  merchantName: "field_merchant_name",
  mid: "field_mid",
  platform: "field_platform",
  subPlatform: "field_sub_platform",
  category: "field_category",
  arr: "field_arr",
  mrr: "field_mrr",
  gmv: "field_gmv",
  txnsPerDay: "field_txns_per_day",
  aov: "field_aov",
  merchantSize: "field_merchant_size",
  city: "field_city",
  goLivePercent: "field_go_live_percent",
  kickOffDate: "field_kick_off_date",
  expectedGoLiveDate: "field_expected_go_live_date",
  goLiveDate: "field_actual_go_live_date",
  salesSpoc: "field_sales_spoc",
  assignedOwnerName: "field_assigned_owner",
  assignedOwner: "field_assigned_owner",
  integrationType: "field_integration_type",
  pgOnboarding: "field_pg_onboarding",
  brandUrl: "field_brand_url",
  jiraLink: "field_jira_link",
  brdLink: "field_brd_link",
  mintChecklistLink: "field_mint_checklist_link",
  integrationChecklistLink: "field_integration_checklist_link",
  mintNotes: "field_mint_notes",
  projectNotes: "field_project_notes",
  currentPhaseComment: "field_current_phase_comment",
  phase2Comment: "field_phase2_comment",
  currentPhase: "field_current_phase",
  phase: "field_current_phase",
  projectState: "field_project_state",
  currentResponsibility: "field_current_responsibility",
  responsibility: "field_current_responsibility",
  checklist: "field_checklist",
  checklistProgress: "field_checklist",
  readiness: "field_readiness",
  healthScore: "field_health_score",
  blocker: "field_blocker",
  confidence: "field_confidence",
  trackerMonth: "field_tracker_month",
};

type GetLabel = (key: string) => string;

/** Resolve the display name for a field key, falling back to the supplied default. */
export const resolveFieldLabel = (getLabel: GetLabel, key: string, fallback: string): string => {
  const labelKey = FIELD_LABEL_KEYS[key];
  if (!labelKey) return fallback;
  const resolved = getLabel(labelKey);
  return resolved && resolved !== labelKey ? resolved : fallback;
};

/** Apply resolveFieldLabel across a list of column definitions. */
export const localizeColumns = <T extends { key: string; label: string }>(
  getLabel: GetLabel,
  columns: T[],
): T[] => columns.map((c) => ({ ...c, label: resolveFieldLabel(getLabel, c.key, c.label) }));
