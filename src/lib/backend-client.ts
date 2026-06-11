import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function getBackendConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["VITE_SUPABASE_URL / SUPABASE_URL"] : []),
      ...(!key ? ["VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY"] : []),
    ];

    throw new Error(`Missing backend environment variable(s): ${missing.join(", ")}`);
  }

  return { url, key };
}

function createBackendClient() {
  const { url, key } = getBackendConfig();

  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let client: ReturnType<typeof createBackendClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createBackendClient>, {
  get(_, prop, receiver) {
    if (!client) client = createBackendClient();
    return Reflect.get(client, prop, receiver);
  },
});