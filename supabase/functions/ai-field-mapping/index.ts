const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

const PROJECT_FIELDS = [
  { key: "merchant_name", label: "Merchant/Brand Name", required: true },
  { key: "mid", label: "Merchant ID (MID)" },
  { key: "platform", label: "Platform" },
  { key: "category", label: "Category" },
  { key: "brand_url", label: "Brand URL" },
  { key: "arr", label: "ARR (Annual Recurring Revenue)" },
  { key: "txns_per_day", label: "Transactions per Day" },
  { key: "aov", label: "Average Order Value (AOV)" },
  { key: "sales_spoc", label: "Sales SPOC / Contact" },
  { key: "mint_notes", label: "MINT / Presales Notes" },
  { key: "project_notes", label: "Project Notes" },
  { key: "current_phase_comment", label: "Current Phase Comment" },
  { key: "integration_type", label: "Integration Type" },
  { key: "pg_onboarding", label: "PG Onboarding" },
  { key: "jira_link", label: "JIRA Link" },
  { key: "brd_link", label: "BRD Link" },
  { key: "kick_off_date", label: "Kick Off / Start Date" },
  { key: "expected_go_live_date", label: "Expected Go Live Date" },
  { key: "go_live_percent", label: "Go Live Percentage" },
  { key: "current_phase", label: "Current Phase (mint/integration/ms/completed)" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvHeaders, sampleRows } = await req.json();

    if (!csvHeaders || !Array.isArray(csvHeaders)) {
      return new Response(JSON.stringify({ error: "csvHeaders array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const projectFieldsList = PROJECT_FIELDS.map(f => `${f.key}: ${f.label}`).join("\n");

    const prompt = `You are a data mapping assistant. Map CSV column headers to project database fields.

CSV Headers: ${JSON.stringify(csvHeaders)}

${sampleRows ? `Sample data (first 2 rows): ${JSON.stringify(sampleRows)}` : ""}

Available project fields:
${projectFieldsList}

Return a JSON object where keys are CSV header names and values are the best matching project field key, or null if no good match.

Rules:
- Only use field keys from the list above
- Be smart about synonyms (e.g. "brand" -> "merchant_name", "revenue" -> "arr", "url" -> "brand_url")
- If a CSV header clearly doesn't match any field, set it to null
- Consider the sample data to improve matching accuracy
- Return ONLY valid JSON, no explanation

Example output:
{"Merchant": "merchant_name", "MID": "mid", "Revenue": "arr", "Random Column": null}`;

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a precise data mapping assistant. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", errText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let mapping: Record<string, string | null>;
    try {
      mapping = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      mapping = {};
    }

    return new Response(JSON.stringify({ mapping, projectFields: PROJECT_FIELDS }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Field mapping error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
