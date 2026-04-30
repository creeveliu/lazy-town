type SyncFailureEmailParams = {
  message: string;
  url: string;
  method: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendSyncFailureEmail({ message, url, method }: SyncFailureEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SYNC_ALERT_EMAIL_TO;
  if (!apiKey || !to) return;

  const from = process.env.SYNC_ALERT_EMAIL_FROM || "Lazy Town <onboarding@resend.dev>";
  const now = new Date().toISOString();
  const subject = "Lazy Town 同步失败";
  const text = [`同步失败`, `时间：${now}`, `请求：${method} ${url}`, `错误：${message}`].join("\n");
  const html = `
    <h2>Lazy Town 同步失败</h2>
    <p><b>时间：</b>${escapeHtml(now)}</p>
    <p><b>请求：</b>${escapeHtml(method)} ${escapeHtml(url)}</p>
    <p><b>错误：</b>${escapeHtml(message)}</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((email) => email.trim()).filter(Boolean),
      subject,
      text,
      html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to send sync failure email: ${response.status} ${body}`);
  }
}
