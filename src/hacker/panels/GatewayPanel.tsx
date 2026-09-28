import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cloud,
  FileText,
  Globe,
  Plug,
  PowerOff,
  Power,
  RotateCcw,
  Star,
  Trash2,
  PencilLine,
} from 'lucide-react';
import { GatewayKind, GatewayListResponse, GatewayView, consoleApi, timeAgo } from '../api';
import { Button, Chip, Field, Notice, Panel, Tone, inputClass } from '../ui';

interface FormState {
  id: string | null;
  kind: GatewayKind;
  name: string;
  baseUrl: string;
  cloudName: string;
  folder: string;
  keyId: string;
  keySecret: string;
  authMode: 'dual' | 'hmac';
  notes: string;
  enabled: boolean;
  primary: boolean;
}

const emptyForm = (): FormState => ({
  id: null,
  kind: 'am-storage',
  name: '',
  baseUrl: '',
  cloudName: '',
  folder: '',
  keyId: '',
  keySecret: '',
  authMode: 'dual',
  notes: '',
  enabled: true,
  primary: true,
});

const kindIcon = (kind: GatewayKind) =>
  kind === 'cloudinary' ? <Cloud className="h-4 w-4" /> : kind === 'am-storage' ? <FileText className="h-4 w-4" /> : <Globe className="h-4 w-4" />;

/**
 * GATEWAYS — add / edit / enable / test / delete every place a file can live.
 *
 * The enabled + primary record of each kind is what uploads really use, so
 * switching a gateway off here stops that traffic immediately (and says so in
 * the admin banner) without touching environment variables.
 */
export const GatewayPanel: React.FC<{
  token: string | null;
  data: GatewayListResponse | null;
  onReload: () => void;
  onToast: (message: string, tone?: Tone) => void;
}> = ({ token, data, onReload, onToast }) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setForm(emptyForm());
  }, [open]);

  const startEdit = (gateway: GatewayView) => {
    setForm({
      id: gateway.id,
      kind: gateway.kind,
      name: gateway.name,
      baseUrl: gateway.baseUrl,
      cloudName: gateway.cloudName,
      folder: gateway.folder,
      keyId: gateway.keyId,
      keySecret: '',
      authMode: gateway.authMode,
      notes: gateway.notes,
      enabled: gateway.enabled,
      primary: gateway.primary,
    });
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('save');
    try {
      const payload: Record<string, unknown> = {
        kind: form.kind,
        name: form.name,
        keyId: form.keyId,
        authMode: form.authMode,
        notes: form.notes,
        enabled: form.enabled,
        primary: form.primary,
      };
      if (form.kind === 'cloudinary') {
        payload.cloudName = form.cloudName;
        payload.folder = form.folder;
      } else {
        payload.baseUrl = form.baseUrl;
      }
      // Never send an empty secret: it means "keep what is stored".
      if (form.keySecret.trim()) payload.keySecret = form.keySecret;

      if (form.id) {
        await consoleApi.updateGateway(token, form.id, payload);
        onToast('গেটওয়ে হালনাগাদ হয়েছে।', 'green');
      } else {
        await consoleApi.createGateway(token, payload);
        onToast('নতুন গেটওয়ে যোগ হয়েছে।', 'green');
      }
      setOpen(false);
      setForm(emptyForm());
      onReload();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const act = async (key: string, label: string, action: () => Promise<string>) => {
    setBusy(key);
    try {
      onToast(`${label}: ${await action()}`, 'green');
      onReload();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items || [];

  return (
    <div className="space-y-5">
      <Panel
        title="Storage Gateways"
        subtitle="ছবি/ভিডিও (Cloudinary), PDF/নথি (AM Storage) এবং কাস্টম HTTP এন্ডপয়েন্ট — সব এখান থেকেই নিয়ন্ত্রিত।"
        actions={
          <>
            <Chip label="registry" value={data?.loaded ? 'loaded' : 'offline'} tone={data?.loaded ? 'green' : 'amber'} pulse={data?.loaded} />
            <Chip label="enabled" value={`${data?.enabled ?? 0}/${data?.total ?? 0}`} tone="cyan" />
            <Button onClick={() => setOpen((value) => !value)} tone="green">
              <Plug className="h-3.5 w-3.5" /> {open ? 'close form' : 'add gateway'}
            </Button>
            <Button
              tone="amber"
              busy={busy === 'restore'}
              onClick={() =>
                act('restore', 'Restored', async () => {
                  const result = await consoleApi.restoreGateways(token);
                  return `${result.restored}টি ডিফল্ট গেটওয়ে ফিরে এসেছে`;
                })
              }
            >
              <RotateCcw className="h-3.5 w-3.5" /> restore defaults
            </Button>
          </>
        }
      >
        {data?.loaded && data.effective ? (
          <div className="mb-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--ha-muted)]">
            <Chip
              label="docs routing"
              value={
                data.effective.documents.configured
                  ? `${data.effective.documents.host} (${data.effective.documents.source})`
                  : 'off'
              }
              tone={data.effective.documents.configured ? 'green' : 'red'}
            />
            <Chip
              label="media routing"
              value={data.effective.media.configured ? `${data.effective.media.cloudName} (${data.effective.media.source})` : 'off'}
              tone={data.effective.media.configured ? 'green' : 'red'}
            />
          </div>
        ) : null}

        {data && !data.loaded ? (
          <Notice tone="amber">
            গেটওয়ে রেজিস্ট্রি এখনো লোড হয়নি (MongoDB বন্ধ/অনুপলব্ধ)। এই সময়ে এনভায়রনমেন্ট ভেরিয়েবলের গেটওয়েগুলো
            স্বয়ংক্রিয়ভাবে ব্যবহার হচ্ছে
            {data.effective
              ? ` — নথি: ${data.effective.documents.configured ? data.effective.documents.host : 'বন্ধ'}, মিডিয়া: ${
                  data.effective.media.configured ? data.effective.media.cloudName || 'configured' : 'বন্ধ'
                }`
              : ''}
            । ডাটাবেস চালু হলেই রেজিস্ট্রি লোড হবে এবং এখান থেকে নিয়ন্ত্রণ করা যাবে।
          </Notice>
        ) : null}

        {open ? (
          <form onSubmit={submit} className="mt-4 grid gap-3 border border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.04)] p-4 sm:grid-cols-2">
            <Field label="type">
              <select
                className={inputClass}
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as GatewayKind }))}
              >
                <option value="am-storage">am-storage — documents / PDF (multipart bridge)</option>
                <option value="cloudinary">cloudinary — image / video</option>
                <option value="external">external — custom HTTP endpoint</option>
              </select>
            </Field>
            <Field label="name" hint="কনসোলে দেখানোর নাম">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="AM Storage — primary"
              />
            </Field>

            {form.kind === 'cloudinary' ? (
              <>
                <Field label="cloud name">
                  <input
                    className={inputClass}
                    value={form.cloudName}
                    onChange={(event) => setForm((prev) => ({ ...prev, cloudName: event.target.value }))}
                    placeholder="vdo_bogura"
                    required
                  />
                </Field>
                <Field label="upload folder">
                  <input
                    className={inputClass}
                    value={form.folder}
                    onChange={(event) => setForm((prev) => ({ ...prev, folder: event.target.value }))}
                    placeholder="vdo_bogura"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="base url" hint="যেমন https://st.thamjj13.top/api/v1">
                  <input
                    className={inputClass}
                    value={form.baseUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    placeholder="https://…"
                    required
                  />
                </Field>
                <Field label="auth mode">
                  <select
                    className={inputClass}
                    value={form.authMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, authMode: event.target.value as 'dual' | 'hmac' }))}
                  >
                    <option value="dual">dual — key id + secret headers</option>
                    <option value="hmac">hmac — signed requests</option>
                  </select>
                </Field>
              </>
            )}

            <Field label={form.kind === 'cloudinary' ? 'api key' : 'key id'}>
              <input
                className={inputClass}
                value={form.keyId}
                onChange={(event) => setForm((prev) => ({ ...prev, keyId: event.target.value }))}
                required
              />
            </Field>
            <Field label={form.kind === 'cloudinary' ? 'api secret' : 'key secret'} hint={form.id ? 'খালি রাখলে আগের সিক্রেটটাই থাকবে' : undefined}>
              <input
                className={inputClass}
                type="password"
                value={form.keySecret}
                onChange={(event) => setForm((prev) => ({ ...prev, keySecret: event.target.value }))}
                placeholder={form.id ? '•••••••• (unchanged)' : ''}
                required={!form.id}
              />
            </Field>
            <Field label="notes" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="অপারেটরের নোট"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--ha-text)]">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                  className="h-4 w-4"
                />
                enabled
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--ha-text)]">
                <input
                  type="checkbox"
                  checked={form.primary}
                  onChange={(event) => setForm((prev) => ({ ...prev, primary: event.target.checked }))}
                  className="h-4 w-4"
                />
                primary (এই ধরনের আপলোড এখানেই যাবে)
              </label>
              <div className="ml-auto flex gap-2">
                <Button tone="muted" onClick={() => setOpen(false)}>
                  cancel
                </Button>
                <Button type="submit" busy={busy === 'save'}>
                  {form.id ? 'save changes' : 'create gateway'}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <Notice tone={data?.loaded ? 'amber' : 'muted'}>
              {data?.loaded
                ? 'রেজিস্ট্রিতে কোনো গেটওয়ে নেই — নতুন গেটওয়ে যোগ করুন, অথবা “restore defaults” চেপে এনভায়রনমেন্ট ডিফল্ট ফিরিয়ে আনুন।'
                : 'রেজিস্ট্রি লোড হলে এখানে সব গেটওয়ে দেখা যাবে (এখন এনভায়রনমেন্ট ফলব্যাক সক্রিয়)।'}
            </Notice>
          ) : null}

          {items.map((gateway) => (
            <article
              key={gateway.id}
              className={`border p-4 ${
                gateway.active
                  ? 'border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.06)]'
                  : 'border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[color:var(--ha-green)]">{kindIcon(gateway.kind)}</span>
                    <h3 className="text-sm font-bold text-[color:var(--ha-text)]">{gateway.name}</h3>
                    {gateway.active ? <Chip label="routing" value="live" tone="green" pulse /> : null}
                    {!gateway.enabled ? <Chip label="state" value="disabled" tone="red" /> : null}
                    {gateway.primary && gateway.enabled ? <Chip label="role" value="primary" tone="cyan" /> : null}
                    {gateway.source === 'environment' ? <Chip label="source" value="env" tone="muted" /> : null}
                  </div>
                  <p className="mt-2 text-[11px] text-[color:var(--ha-muted)]">
                    {gateway.kindLabel} · {gateway.host} {gateway.folder ? `· folder ${gateway.folder}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--ha-muted)]">
                    key {gateway.keyIdMasked || '—'} · secret {gateway.secretPreview || '—'} · {gateway.authMode} ·{' '}
                    {gateway.usedFor}
                  </p>
                  {gateway.notes ? <p className="mt-1 text-[11px] text-[color:var(--ha-text)]">“{gateway.notes}”</p> : null}
                  {gateway.lastTest ? (
                    <p className={`mt-2 text-[11px] ${gateway.lastTest.ok ? 'text-[color:var(--ha-green)]' : 'text-[color:var(--ha-red)]'}`}>
                      <Activity className="mr-1 inline h-3 w-3" />
                      {gateway.lastTest.ok ? 'TEST OK' : 'TEST FAILED'} · {gateway.lastTest.status ?? '—'} ·{' '}
                      {gateway.lastTest.latencyMs}ms · {timeAgo(gateway.lastTest.at)} — {gateway.lastTest.message}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-[color:var(--ha-muted)]">এখনো পরীক্ষা করা হয়নি।</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="cyan"
                    busy={busy === `test:${gateway.id}`}
                    onClick={() =>
                      act(`test:${gateway.id}`, 'Test', async () => {
                        const result = await consoleApi.testGateway(token, gateway.id);
                        return result.test.message;
                      })
                    }
                  >
                    <Activity className="h-3.5 w-3.5" /> test
                  </Button>
                  <Button
                    tone={gateway.enabled ? 'amber' : 'green'}
                    busy={busy === `toggle:${gateway.id}`}
                    onClick={() =>
                      act(`toggle:${gateway.id}`, gateway.enabled ? 'Disabled' : 'Enabled', async () => {
                        await consoleApi.updateGateway(token, gateway.id, { enabled: !gateway.enabled });
                        return gateway.enabled ? 'গেটওয়ে বন্ধ করা হয়েছে' : 'গেটওয়ে চালু করা হয়েছে';
                      })
                    }
                  >
                    {gateway.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    {gateway.enabled ? 'disable' : 'enable'}
                  </Button>
                  {!gateway.primary ? (
                    <Button
                      busy={busy === `primary:${gateway.id}`}
                      onClick={() =>
                        act(`primary:${gateway.id}`, 'Primary', async () => {
                          await consoleApi.updateGateway(token, gateway.id, { primary: true, enabled: true });
                          return 'এই গেটওয়ে এখন প্রাইমারি';
                        })
                      }
                    >
                      <Star className="h-3.5 w-3.5" /> make primary
                    </Button>
                  ) : null}
                  <Button tone="muted" onClick={() => startEdit(gateway)}>
                    <PencilLine className="h-3.5 w-3.5" /> edit
                  </Button>
                  <Button
                    tone="red"
                    busy={busy === `delete:${gateway.id}`}
                    onClick={() => {
                      if (!window.confirm(`"${gateway.name}" গেটওয়ে মুছে ফেলবেন?\n\nএই ধরনের আপলোড সাথে সাথে বন্ধ হয়ে যাবে।`))
                        return;
                      void act(`delete:${gateway.id}`, 'Deleted', async () => {
                        const result = await consoleApi.deleteGateway(token, gateway.id);
                        return result.message;
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
};
