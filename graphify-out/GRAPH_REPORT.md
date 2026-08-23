# Graph Report - handover-prod  (2026-08-23)

## Corpus Check
- 152 files · ~98,679 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 474 nodes · 455 edges · 17 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 15 edges
2. `String()` - 12 edges
3. `fetchAiInsights()` - 10 edges
4. `fetch()` - 10 edges
5. `toText()` - 8 edges
6. `executeWorkflowAction()` - 7 edges
7. `executeToolCall()` - 6 edges
8. `matchWorkflow()` - 6 edges
9. `getTime()` - 6 edges
10. `sendWorkflowEmail()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `getCellValue()` --calls--> `String()`  [INFERRED]
  supabase/functions/send-scheduled-report/index.ts → src/components/ManagerDashboard.tsx
- `toText()` --calls--> `String()`  [INFERRED]
  supabase/functions/_shared/workflow-engine.ts → src/components/ManagerDashboard.tsx
- `sendWorkflowEmail()` --calls--> `fetch()`  [INFERRED]
  supabase/functions/_shared/workflow-engine.ts → src/components/settings/ChecklistFormsManager.tsx
- `resolveWorkflowOwner()` --calls--> `String()`  [INFERRED]
  supabase/functions/ai-chat/index.ts → src/components/ManagerDashboard.tsx
- `normalizeWorkflowArgs()` --calls--> `String()`  [INFERRED]
  supabase/functions/ai-chat/index.ts → src/components/ManagerDashboard.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (17): useAuth(), LabelsProvider(), useLabels(), useAddChecklistComment(), useFormResponses(), useCustomFieldValues(), useAcceptProject(), useAddProject() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (10): handlePollEmails(), handleAssign(), getAuthToken(), handleCreateUser(), handleDeleteUser(), handleEditUser(), handleSetPassword(), handleTriggerNow() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (12): handleResponsibilityChange(), handleAddProject(), handleBulkDelete(), handleAccept(), handleReject(), handleTransfer(), acceptProject(), addProject() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (13): beginDrag(), getTime(), handleHeaderPress(), handleKeyDown(), handleLauncherPress(), saveMessage(), sendMessage(), calculateRiskAssessment() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (15): generateAlerts(), handleInsights(), calculateProjectStats(), fetchProjectAiInsight(), fetchTeamAiInsight(), calculateTimeFromChecklist(), createDefaultChecklist(), createDefaultProject() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (10): getFieldLabel(), getFieldValue(), handleProjectDrop(), getColValue(), getNavVisibility(), getProjectPhaseLabel(), handleBulkEdit(), handleBulkStateUpdate() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (14): executeToolCall(), findEmailInText(), getSampleWorkflowDefinitions(), logActivity(), normalizeWorkflowArgs(), resolveWorkflowOwner(), String(), getCellValue() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.23
Nodes (11): buildTemplateValues(), executeWorkflowAction(), getChanged(), getRecordValue(), inferChecklistEventType(), insertActivity(), interpolate(), matchWorkflow() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (3): formatAggVal(), formatPivotVal(), handleSaveReport()

### Community 10 - "Community 10"
Cohesion: 0.39
Nodes (7): buildProject(), handleFileSelect(), handleMappingConfirm(), mapPhaseToEnum(), mapPhaseToTeam(), parseCSVLine(), parseCSVRows()

### Community 11 - "Community 11"
Cohesion: 0.36
Nodes (6): fetchTenants(), handleCreateManager(), handleSaveTenant(), handleToggleActive(), openCreateDialog(), resetForm()

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (4): fetchFields(), generateKey(), handleDelete(), handleSave()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (7): addToRemoveQueue(), dispatch(), genId(), reducer(), toast(), useToast(), Toaster()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (2): handleDownload(), exportFormToCSV()

### Community 17 - "Community 17"
Cohesion: 0.38
Nodes (3): fetchWorkflows(), handleDelete(), handleSave()

### Community 23 - "Community 23"
Cohesion: 0.83
Nodes (3): delay(), logWorkflowProcessingFailure(), processWorkflowEvents()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (2): handleKeyDown(), handleSubmit()

## Knowledge Gaps
- **Thin community `Community 16`** (7 nodes): `getValue()`, `handleChange()`, `handleDownload()`, `handleSave()`, `ChecklistFormDialog.tsx`, `exportFormCSV.ts`, `exportFormToCSV()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (4 nodes): `handleFileSelect()`, `handleKeyDown()`, `handleSubmit()`, `ChecklistCommentThread.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetch()` connect `Community 1` to `Community 9`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `String()` connect `Community 6` to `Community 8`, `Community 4`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `fetchAiInsights()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `useAuth()` (e.g. with `LabelsProvider()` and `useFormResponses()`) actually correct?**
  _`useAuth()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `String()` (e.g. with `getCellValue()` and `resolveWorkflowOwner()`) actually correct?**
  _`String()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `fetchAiInsights()` (e.g. with `fetch()` and `generateAlerts()`) actually correct?**
  _`fetchAiInsights()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `fetch()` (e.g. with `sendWorkflowEmail()` and `fetchAiInsights()`) actually correct?**
  _`fetch()` has 9 INFERRED edges - model-reasoned connections that need verification._