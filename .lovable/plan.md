
# Plan: Fix Project Dashboard Issues

This plan addresses the 4 issues you reported:

## Issue 1: Remove GoKwik/Merchant Toggle from Project Tile

**Current Behavior**: Each project card shows a GoKwik/Merchant toggle switch in the project list.

**Solution**: Remove the responsibility toggle from `ProjectCardNew.tsx`:
- Remove the desktop toggle (lines 122-141)
- Remove the mobile toggle section (lines 214-232)
- Keep the toggle only in the Project Details dialog and Checklist dialog

---

## Issue 2: Auto-Select "Action Pending On" Based on Checklist Items

**Current Behavior**: Project-level responsibility is manually toggled, separate from checklist item responsibilities.

**Solution**: Calculate project responsibility automatically based on checklist items:
- If any active (non-neutral, uncompleted) checklist item is on "Merchant", set project responsibility to "Merchant"
- If all active items are on "GoKwik", set project responsibility to "GoKwik"
- If all items are neutral or completed, set to "Neutral"

**Implementation**:
1. Add a utility function `calculateProjectResponsibilityFromChecklist()`
2. Modify `ProjectDetailsDialog` to show computed responsibility (read-only display)
3. Remove the manual project-level toggle from `ResponsibilityToggle` component
4. Time calculation will use the individual checklist item responsibility logs instead of project-level logs

---

## Issue 3: Manager Dashboard User Creation Issue

**Root Cause**: When a manager creates a user using `supabase.auth.signUp()`, Supabase automatically logs in as the newly created user, logging out the manager.

**Solution**: Create an Edge Function to handle user creation:
1. Create `create-user` Edge Function that uses the Supabase Admin API (service role key)
2. The Edge Function will:
   - Create the user in auth.users
   - Verify profile and role records are created (by the existing trigger)
3. Update `UserManagement.tsx` to call this Edge Function instead of `signUp()`
4. Manager stays logged in, new user is created without affecting current session

---

## Issue 4: Integration Checklist Not Visible to Integration Team

**Root Cause**: After investigation, the database has both MINT (9 items) and Integration (6 items) checklists for each project. The display issue may be:
- Scroll area not showing the Integration section (below MINT)
- Or the specific project viewed has fewer items

**Solution**: Modify `ChecklistDialog.tsx` to:
1. Show the current user's team checklist first (Integration team sees Integration checklist at top)
2. Show other team's checklist in collapsed/read-only mode
3. Add clear visual separators between team checklists
4. Fix task count display to show "MINT: 0/9" and "Integration: 0/6" correctly

---

## Technical Implementation Details

### Files to Modify:
1. `src/components/ProjectCardNew.tsx` - Remove responsibility toggle
2. `src/components/ProjectDetailsDialog.tsx` - Show computed responsibility
3. `src/components/ResponsibilityToggle.tsx` - Make it read-only for project level
4. `src/components/ChecklistDialog.tsx` - Reorder checklists by user team, improve layout
5. `src/components/UserManagement.tsx` - Use Edge Function for user creation
6. `src/data/projectsData.ts` - Add utility function for computing responsibility

### New Files:
- `supabase/functions/create-user/index.ts` - Edge Function for admin user creation

### Database Changes:
None required - existing trigger `handle_new_user` works correctly when called via Admin API.

---

## Expected Outcomes

1. **Project tiles**: Cleaner cards without toggle, responsibility managed at checklist level
2. **Time tracking**: More accurate, based on individual checklist items
3. **User creation**: Managers can add users without being logged out
4. **Checklist visibility**: Integration team sees their checklist prominently, can view MINT checklist for context
