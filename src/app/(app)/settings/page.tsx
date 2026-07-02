import { CheckCircle2, CircleAlert, Mail, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { AddUserForm } from "@/components/AddUserForm";
import { saveSettings, disconnectGmail, removeAppUser } from "@/app/actions/settings";
import { aiConfigured } from "@/lib/ai/client";
import { gmailConfigured, getRedirectUri } from "@/lib/gmail/client";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const supabase = await createClient();

  const [settingsRes, usersRes] = await Promise.all([
    supabase.from("biscuit_app_settings").select("*").eq("id", 1).single(),
    supabase.from("biscuit_app_users").select("*").order("created_at"),
  ]);
  const settings = settingsRes.data;
  const users = (usersRes.data ?? []).filter((u) => !u.email.endsWith("@biscuit.internal"));

  const googleReady = gmailConfigured();
  const inboxConnected = Boolean(settings?.gmail_connected_email);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" sub="Wiring for the inbox, accounting, and family" />

      {connected ? (
        <Card className="border-leaf bg-leaf-soft/60">
          <div className="px-5 py-3.5 text-sm font-bold text-leaf">
            Gmail connected — Biscuit is watching the inbox now.
          </div>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-denied bg-denied-soft/60">
          <div className="px-5 py-3.5 text-sm font-bold text-denied">
            Something went wrong: {error.replace(/_/g, " ")}
          </div>
        </Card>
      ) : null}

      {/* Gmail connection */}
      <Card>
        <CardHeader title="Rescue inbox (Gmail)" />
        <div className="px-5 pb-5 space-y-3 text-sm">
          {inboxConnected ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-leaf">
                <CheckCircle2 size={17} />
                Connected as {settings?.gmail_connected_email}
              </p>
              <p className="text-ink-soft">
                Biscuit checks this inbox automatically: PACC 911 requests become cases with a
                reply drafted in Gmail, and emailed receipts are filed and forwarded to Dext.
                Last check: {formatDateTime(settings?.last_synced_at)}.
              </p>
              <form action={disconnectGmail}>
                <SubmitButton variant="secondary" pendingText="Disconnecting…">
                  Disconnect
                </SubmitButton>
              </form>
            </>
          ) : googleReady ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-[#7a5a1f]">
                <CircleAlert size={17} /> Not connected yet
              </p>
              <p className="text-ink-soft">
                Sign in with the dedicated rescue Gmail account (e.g. RowleyPetRescue@gmail.com).
                Biscuit only touches that mailbox — reading requests, queuing drafts, and
                forwarding receipts.
              </p>
              <a
                href="/api/gmail/oauth/start"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-deep transition-colors"
              >
                <Mail size={16} /> Connect Gmail
              </a>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold text-[#7a5a1f]">
                <CircleAlert size={17} /> Google OAuth isn't configured on the server yet
              </p>
              <div className="text-ink-soft space-y-2">
                <p>One-time setup (about 10 minutes):</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Create the dedicated Gmail account (e.g. RowleyPetRescue@gmail.com) — a free account is fine.</li>
                  <li>
                    In{" "}
                    <a className="text-accent-deep font-bold hover:underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                      Google Cloud Console
                    </a>
                    , create a project, enable the <strong>Gmail API</strong>, and configure the OAuth consent screen (External, then add the rescue Gmail address as a test user).
                  </li>
                  <li>
                    Create an <strong>OAuth client ID</strong> (type: Web application) with redirect URI:{" "}
                    <code className="bg-cream border border-line rounded px-1.5 py-0.5 text-xs">{getRedirectUri()}</code>
                  </li>
                  <li>
                    Set <code className="bg-cream border border-line rounded px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                    <code className="bg-cream border border-line rounded px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code> in the app's environment variables, then redeploy.
                  </li>
                </ol>
              </div>
            </>
          )}
          <p className={`flex items-center gap-2 text-xs font-semibold ${aiConfigured() ? "text-leaf" : "text-denied"}`}>
            {aiConfigured() ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
            AI parsing & drafting {aiConfigured() ? "ready" : "off — set ANTHROPIC_API_KEY in the environment"}
          </p>
        </div>
      </Card>

      {/* Workflow settings */}
      <Card>
        <CardHeader title="Workflow" />
        <form action={saveSettings} className="px-5 pb-5 space-y-4 text-sm">
          <label className="block">
            <span className="block font-bold text-ink-soft mb-1">PACC 911 sender emails</span>
            <input
              name="pacc_senders"
              defaultValue={(settings?.pacc_sender_emails ?? []).join(", ")}
              placeholder="barry@pacc911.org, doug@pacc911.org"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">Comma-separated. Helps Biscuit recognize case requests.</span>
          </label>
          <label className="block">
            <span className="block font-bold text-ink-soft mb-1">BCC on owner replies</span>
            <input
              name="barry_bcc"
              type="email"
              defaultValue={settings?.barry_bcc_email ?? ""}
              placeholder="barry@pacc911.org"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">Barry gets a copy of every intro email so PACC 911 stays in the loop.</span>
          </label>
          <label className="block">
            <span className="block font-bold text-ink-soft mb-1">Dext accounting email</span>
            <input
              name="dext_email"
              type="email"
              defaultValue={settings?.dext_email ?? ""}
              placeholder="yourname@dext.cc"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">Every receipt is forwarded here for the accountant.</span>
          </label>
          <label className="block">
            <span className="block font-bold text-ink-soft mb-1">Email signature</span>
            <textarea
              name="signature"
              rows={3}
              defaultValue={settings?.reply_signature ?? "Warmly,\nChelsea\nRowley Family Charitable Giving Trust"}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">Used to sign the drafted owner replies.</span>
          </label>
          <div className="border-t border-line pt-4 space-y-3">
            <label className="block">
              <span className="block font-bold text-ink-soft mb-1">Family recap recipients</span>
              <input
                name="family_recipients"
                defaultValue={(settings?.family_recipient_emails ?? []).join(", ")}
                placeholder="mom@example.com, dad@example.com"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center gap-2.5 font-semibold">
              <input
                type="checkbox"
                name="recap_enabled"
                defaultChecked={settings?.monthly_recap_enabled ?? false}
                className="h-4 w-4 accent-[#c05f33]"
              />
              Send the recap automatically on the 1st of each month
            </label>
          </div>
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        </form>
      </Card>

      {/* Access */}
      <Card>
        <CardHeader title="Who can sign in" />
        <div className="px-5 pb-5 space-y-4 text-sm">
          <ul className="divide-y divide-line rounded-xl border border-line overflow-hidden">
            {users.map((u) => (
              <li key={u.email} className="flex items-center justify-between gap-3 bg-cream px-4 py-2.5">
                <div>
                  <span className="font-bold">{u.display_name ?? u.email}</span>
                  {u.display_name ? <span className="text-muted"> · {u.email}</span> : null}
                </div>
                <form action={removeAppUser.bind(null, u.email)}>
                  <button className="text-muted hover:text-denied transition-colors" title="Remove access">
                    <Trash2 size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <AddUserForm />
          <p className="text-xs text-muted">
            Adding an email allows that person to sign in once an account exists for them. Ask
            Trevor to finish account creation if their login doesn't work yet.
          </p>
        </div>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader title="Your password" />
        <div className="px-5 pb-5">
          <ChangePasswordForm />
        </div>
      </Card>
    </div>
  );
}
