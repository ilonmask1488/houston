import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog, Screen, Segmented, Switch } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { BackupError, downloadBackup, importBackup, parseBackup, type Backup } from '../../lib/backup/backup'
import { db, resetProgress } from '../../lib/db/db'
import type { Settings } from '../../lib/db/types'
import { updateSettings, useSettings } from '../../lib/settings/settings'
import { recognitionSupported } from '../../lib/speech/recognize'
import s from './SettingsScreen.module.css'

export function SettingsScreen() {
  const t = ru.settings
  const settings = useSettings()
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const set = (patch: Partial<Settings>) =>
    updateSettings(patch).catch((e) => {
      console.error(e)
      setMessage({ text: ru.errors.storage, error: true })
    })
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
  const canAsr = recognitionSupported()

  return (
    <Screen title={t.title} back>
      <Section title={t.session}>
        <Field label={t.duration} hint={t.durationHint}>
          <Segmented
            label={t.duration}
            value={settings.sessionMinutes}
            options={([20, 30, 45] as const).map((m) => ({ value: m, label: t.minutes(m) }))}
            onChange={(v) => set({ sessionMinutes: v })}
          />
        </Field>
        <Field label={t.answerSeconds} hint={t.answerSecondsHint}>
          <Segmented
            label={t.answerSeconds}
            value={settings.answerSeconds}
            options={([5, 7, 10] as const).map((n) => ({ value: n, label: `${n} с` }))}
            onChange={(v) => set({ answerSeconds: v })}
          />
        </Field>
        <Field label={t.retention} hint={t.retentionHint}>
          <Segmented
            label={t.retention}
            value={settings.desiredRetention}
            options={([0.85, 0.9, 0.95] as const).map((r) => ({ value: r, label: `${Math.round(r * 100)}%` }))}
            onChange={(v) => set({ desiredRetention: v })}
          />
        </Field>
      </Section>

      <Section title={t.language}>
        <Field label={t.variant} hint={t.variantHint}>
          <Segmented
            label={t.variant}
            value={settings.variant}
            options={[
              { value: 'us', label: t.variantUs },
              { value: 'gb', label: t.variantGb },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </Field>
        <Field label={t.voice}>
          <Segmented
            label={t.voice}
            value={settings.voice}
            options={[
              { value: 'female', label: t.voiceFemale },
              { value: 'male', label: t.voiceMale },
            ]}
            onChange={(v) => set({ voice: v })}
          />
        </Field>
        <Field label={t.accents} hint={t.accentsHint}>
          <Segmented
            label={t.accents}
            value={settings.accents}
            options={[
              { value: 'all', label: t.accentsAll },
              { value: 'main', label: t.accentsMain },
            ]}
            onChange={(v) => set({ accents: v })}
          />
        </Field>
        <Switch
          label={t.asr}
          hint={canAsr ? t.asrHint : t.asrUnsupported}
          checked={settings.asr && canAsr}
          disabled={!canAsr}
          onChange={(v) => set({ asr: v })}
        />
      </Section>

      <Section title={t.feedback}>
        <Switch label={t.sfx} checked={settings.sfx} onChange={(v) => set({ sfx: v })} />
        <Switch
          label={t.vibration}
          hint={canVibrate ? undefined : t.vibrationUnsupported}
          checked={settings.vibration && canVibrate}
          disabled={!canVibrate}
          onChange={(v) => set({ vibration: v })}
        />
      </Section>

      <Section title={t.display}>
        <Field label={t.theme}>
          <Segmented
            label={t.theme}
            value={settings.theme}
            options={[
              { value: 'system', label: t.themeSystem },
              { value: 'light', label: t.themeLight },
              { value: 'dark', label: t.themeDark },
            ]}
            onChange={(v) => set({ theme: v })}
          />
        </Field>
      </Section>

      <DataSection onMessage={setMessage} />

      <p className={`${s.message} ${message?.error ? s.error : ''}`} role="status" aria-live="polite">
        {message?.text}
      </p>
    </Screen>
  )
}

function DataSection({ onMessage }: { onMessage: (m: { text: string; error?: boolean }) => void }) {
  const t = ru.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const meta = useLiveQuery(async () => ({
    lastBackupAt: await db.getMeta<number>('lastBackupAt'),
    persisted: await db.getMeta<boolean>('storagePersisted'),
  }))

  const fail = (e: unknown) => {
    console.error(e)
    onMessage({ text: e instanceof BackupError ? e.message : ru.errors.generic, error: true })
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      fail(e)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Section title={t.data}>
      <p className={s.hint}>{t.dataHint}</p>
      <div className={s.buttons}>
        <button
          type="button"
          className={ui.secondary}
          onClick={() =>
            downloadBackup()
              .then(() => onMessage({ text: t.exportDone }))
              .catch(fail)
          }
        >
          {t.exportBackup}
        </button>
        <button type="button" className={ui.secondary} onClick={() => fileRef.current?.click()}>
          {t.importBackup}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="backup-file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <p className={s.hint}>{t.lastBackup(meta?.lastBackupAt ? new Date(meta.lastBackupAt).toLocaleDateString('ru-RU') : null)}</p>
      {meta && meta.persisted !== undefined && <p className={s.hint}>{meta.persisted ? t.storagePersisted : t.storageNotPersisted}</p>}
      <div className={s.buttons}>
        <button type="button" className={ui.danger} onClick={() => setConfirmReset(true)}>
          {t.reset}
        </button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t.importBackup}
        confirm={t.importBackup}
        cancel={t.resetCancel}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const b = pending
          setPending(null)
          if (b)
            importBackup(b)
              .then(() => onMessage({ text: t.importDone }))
              .catch(fail)
        }}
      >
        {t.importConfirm}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmReset}
        title={t.resetTitle}
        confirm={t.resetConfirm}
        cancel={t.resetCancel}
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false)
          resetProgress()
            .then(() => onMessage({ text: t.resetDone }))
            .catch(fail)
        }}
      >
        {t.resetText}
      </ConfirmDialog>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  )
}
