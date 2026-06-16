import { supabase } from "@/lib/backend-client";

export type WebhookPayload = {
  event: 'sale_submitted' | 'sale_approved' | 'sale_activated';
  sale_id: string;
  rep_name: string;
  customer_name: string;
  spm_number: string;
  lines: number;
  sale_type: string;
  package_type: string;
  sale_date: string;
  status: string;
  timestamp: string;
};

export async function triggerWebhook(payload: WebhookPayload, webhookUrl: string): Promise<boolean> {
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const success = response.ok;
    const responseBody = await response.text().catch(() => '');

    // Log webhook attempt
    await supabase.from('webhook_logs').insert({
      sale_id: payload.sale_id,
      webhook_url: webhookUrl,
      payload,
      response_status: response.status,
      response_body: responseBody || null,
      success,
    }).catch(() => {});

    return success;
  } catch (error) {
    // Log error
    await supabase.from('webhook_logs').insert({
      sale_id: payload.sale_id,
      webhook_url: webhookUrl,
      payload,
      response_status: null,
      response_body: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    }).catch(() => {});

    return false;
  }
}
