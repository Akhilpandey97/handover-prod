import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_DIR = process.env.CSV_DIR || "/Users/akhilpandey/Downloads";
const MIGRATION_DEFAULT_PASSWORD = process.env.MIGRATION_DEFAULT_PASSWORD || "ChangeMe@123!";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const importPlan = [
  ["tenants", "tenants-export-2026-03-20_15-59-25.csv"],
  ["profiles", "profiles-export-2026-03-20_15-58-16.csv"],
  ["user_roles", "user_roles-export-2026-03-20_15-59-58.csv"],
  ["checklist_templates", "checklist_templates-export-2026-03-20_15-57-07.csv"],
  ["checklist_form_templates", "checklist_form_templates-export-2026-03-20_15-56-19.csv"],
  ["custom_fields", "custom_fields-export-2026-03-20_15-57-36.csv"],
  ["projects", "projects-export-2026-03-20_15-58-47.csv"],
  ["project_responsibility_logs", "project_responsibility_logs-export-2026-03-20_15-58-30.csv"],
  ["transfer_history", "transfer_history-export-2026-03-20_15-59-44.csv"],
  ["checklist_items", "checklist_items-export-2026-03-20_15-56-26.csv"],
  ["checklist_responsibility_logs", "checklist_responsibility_logs-export-2026-03-20_15-56-47.csv"],
  ["custom_field_values", "custom_field_values-export-2026-03-20_15-57-21.csv"],
  ["app_settings", "app_settings-export-2026-03-20_15-55-06.csv"],
  ["chat_messages", "chat_messages-export-2026-03-20_15-55-22.csv"],
  ["checklist_comments", "checklist_comments-export-2026-03-20_15-55-36.csv"],
  ["checklist_form_fields", "checklist_form_fields-export-2026-03-20_15-55-58.csv"],
  ["checklist_form_assignments", "checklist_form_assignments-export-2026-03-20_15-55-49.csv"],
  ["checklist_form_responses", "checklist_form_responses-export-2026-03-20_15-56-06.csv"],
  ["parsed_emails", "parsed_emails-export-2026-03-20_15-57-52.csv"],
  ["saved_reports", "saved_reports-export-2026-03-20_15-59-18.csv"],
  ["report_executions", "report_executions-export-2026-03-20_15-59-01.csv"],
];

const booleanFields = new Set([
  "completed",
  "pending_acceptance",
  "is_active",
]);

const numberFields = new Set([
  "arr",
  "txns_per_day",
  "aov",
  "go_live_percent",
  "sort_order",
  "email_count",
]);

const jsonFields = new Set([
  "options",
  "parsed_fields",
  "columns",
  "schedule",
  "recipients",
]);

const conflictTargets = {
  user_roles: "user_id,role",
};

function splitLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(filePath) {
  const python = spawnSync(
    "python3",
    [
      "-c",
      `
import csv, json, sys
with open(sys.argv[1], newline='', encoding='utf-8-sig') as fh:
    rows = list(csv.DictReader(fh, delimiter=';'))
print(json.dumps(rows))
      `,
      filePath,
    ],
    { encoding: "utf8" },
  );

  if (python.status !== 0) {
    throw new Error(`CSV parse failed for ${filePath}: ${python.stderr || python.stdout}`);
  }

  return JSON.parse(python.stdout);
}

function convertValue(field, value) {
  if (value === "") {
    return null;
  }

  if (booleanFields.has(field)) {
    return value === "true";
  }

  if (numberFields.has(field)) {
    return Number(value);
  }

  if (jsonFields.has(field)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => [field, convertValue(field, value)]),
  );
}

async function upsertRows(table, rows) {
  if (rows.length === 0) {
    console.log(`Skipping ${table}: 0 rows`);
    return;
  }

  const chunkSize = 100;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: conflictTargets[table] || "id",
    });
    if (error) {
      throw new Error(`${table} import failed at row ${start + 1}: ${error.message}`);
    }
  }

  const { count, error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) {
    throw new Error(`${table} verification failed: ${error.message}`);
  }

  console.log(`Imported ${table}: ${rows.length} rows (remote count: ${count ?? "unknown"})`);
}

async function ensureAuthUsers(profileRows) {
  for (const profile of profileRows) {
    const id = profile.id;
    const email = profile.email;
    if (!id || !email) {
      continue;
    }

    const { data: existingById, error: existingErr } = await supabase.auth.admin.getUserById(id);
    if (!existingErr && existingById?.user) {
      continue;
    }

    const { error } = await supabase.auth.admin.createUser({
      id,
      email,
      password: MIGRATION_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: profile.name,
        team: profile.team,
      },
    });

    if (error && !/already been registered|already exists/i.test(error.message)) {
      throw new Error(`auth user create failed for ${email}: ${error.message}`);
    }
  }
}

for (const [table, fileName] of importPlan) {
  const filePath = path.join(CSV_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${table}: file not found (${fileName})`);
    continue;
  }

  const rows = parseCsv(filePath).map(normalizeRow);
  if (table === "profiles") {
    await ensureAuthUsers(rows);
    console.log(`Provisioned auth users for ${rows.length} profiles`);
  }
  await upsertRows(table, rows);
}
