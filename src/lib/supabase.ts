const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

export type BusinessInsert = {
  id: string;
  owner_id: string | null;
  name: string;
  wallet_adress: string | null;
  description: string | null;
  created_at: string;
  nfc_adress: string | null;
};

export type ProfileUpsert = {
  id: string;
  wallet_pubkey: string | null;
  role: string;
  display_name: string | null;
  created_at: string;
};

export async function createBusiness(
  business: BusinessInsert
) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY"
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/businesses`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(business),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? [
            data.message,
            data.details,
            data.hint,
            data.code,
          ]
            .filter(Boolean)
            .join(" | ")
        : "";

    throw new Error(
      !message
        ? "Failed to create business"
        : message
    );
  }

  return data;
}

export async function ensureProfile(
  profile: ProfileUpsert
) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY"
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?on_conflict=id`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer:
          "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(profile),
    }
  );

  if (!response.ok) {
    const data = await response.json();

    throw new Error(
      data && typeof data === "object" && data.message
        ? data.message
        : "Failed to ensure profile"
    );
  }
}
