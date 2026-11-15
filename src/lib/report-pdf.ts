import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { adherenceTone, formatShortDate, type AdherenceSummary } from '@/lib/adherence';
import { formatReminderTime } from '@/lib/reminders';
import { formatVisitDate, type VisitRecord } from '@/lib/visits';

/*
 * Doctor report: active medications, 30-day adherence and the visit log, rendered to a PDF on the
 * phone (expo-print) and handed to the share sheet (expo-sharing). Nothing is uploaded by the app;
 * the patient chooses where it goes.
 *
 * The PDF is always light-themed and print-friendly, whatever the app's color scheme. Images must be
 * inline (iOS can't load local asset URLs while printing), so the chart is an inline SVG.
 */

// A4 at 72 PPI.
const PAGE = { width: 595, height: 842 };

const INK = '#232528';
const MUTED = '#55524B';
const RULE = '#DCD3C2';
const SUCCESS = '#1B6A44';
const WARNING = '#874C00';
const DANGER = '#A61E2D';

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TONE_HEX = { success: SUCCESS, warning: WARNING, danger: DANGER, none: RULE } as const;

function pct(percent: number | null) {
  return percent == null ? '—' : `${percent}%`;
}

function chartSvg(summary: AdherenceSummary) {
  const w = 515;
  const h = 150;
  const left = 30;
  const bottom = 20;
  const plotW = w - left;
  const plotH = h - bottom - 6;
  const slot = plotW / summary.days.length;
  const barW = slot * 0.62;

  const grid = [0, 50, 100]
    .map((v) => {
      const y = 6 + plotH - (v / 100) * plotH;
      return `<line x1="${left}" x2="${w}" y1="${y}" y2="${y}" stroke="${RULE}" stroke-width="0.75" />
        <text x="${left - 6}" y="${y + 3}" font-size="8" text-anchor="end" fill="${MUTED}">${v}%</text>`;
    })
    .join('');

  const bars = summary.days
    .map((d, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      const label =
        i % 7 === 0 || i === summary.days.length - 1
          ? `<text x="${x + barW / 2}" y="${h - 6}" font-size="8" text-anchor="middle" fill="${MUTED}">${esc(formatShortDate(d.dayStart))}</text>`
          : '';
      if (d.percent == null) return label;
      // A 0% day still gets a sliver so it reads as "nothing taken", not "nothing due".
      const barH = Math.max((d.percent / 100) * plotH, 2);
      const y = 6 + plotH - barH;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="${TONE_HEX[adherenceTone(d.percent)]}" />${label}`;
    })
    .join('');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${bars}</svg>`;
}

export function buildReportHtml({
  summary,
  visits,
  patient,
  generatedAt = Date.now(),
}: {
  summary: AdherenceSummary;
  visits: Pick<VisitRecord, 'visitedAt' | 'facility' | 'doctor' | 'reason' | 'notes'>[];
  patient?: string;
  generatedAt?: number;
}) {
  const range = `${formatVisitDate(summary.from)} – ${formatVisitDate(summary.to)}`;
  const total = summary.taken + summary.skipped + summary.missed;

  const medsRows = summary.medications.length
    ? summary.medications
        .map(
          (m) => `<tr>
            <td><strong>${esc(m.medication)}</strong></td>
            <td>${esc(m.dosage)}</td>
            <td>${m.reminderMinutes == null ? '<span class="muted">No reminder</span>' : `Daily, ${esc(formatReminderTime(m.reminderMinutes))}`}</td>
            <td class="num">${m.taken}</td>
            <td class="num">${m.skipped}</td>
            <td class="num">${m.missed}</td>
            <td class="num" style="color:${m.percent == null ? MUTED : TONE_HEX[adherenceTone(m.percent)]}"><strong>${pct(m.percent)}</strong></td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="muted">No active medications.</td></tr>`;

  const visitRows = visits.length
    ? visits
        .map(
          (v) => `<tr>
            <td class="nowrap">${esc(formatVisitDate(v.visitedAt))}</td>
            <td>${esc(v.facility || '—')}</td>
            <td>${esc(v.doctor || '—')}</td>
            <td>${esc(v.reason || '—')}${v.notes ? `<div class="muted small">${esc(v.notes)}</div>` : ''}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="muted">No visits logged.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 36px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: ${INK}; font-size: 11px; line-height: 1.45; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid ${INK}; }
  .muted { color: ${MUTED}; }
  .small { font-size: 10px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; }
  .stats { display: flex; gap: 10px; margin-bottom: 12px; }
  .stat { flex: 1; border: 1px solid ${RULE}; border-radius: 8px; padding: 8px 10px; }
  .stat .value { font-size: 18px; font-weight: 700; }
  .stat .label { color: ${MUTED}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: ${MUTED}; padding: 4px 6px; border-bottom: 1px solid ${RULE}; }
  td { padding: 6px; border-bottom: 1px solid ${RULE}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .nowrap { white-space: nowrap; }
  .legend { display: flex; gap: 14px; margin-top: 4px; font-size: 9px; color: ${MUTED}; }
  .swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .footer { margin-top: 24px; font-size: 9px; color: ${MUTED}; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Medication &amp; Adherence Report</h1>
      ${patient ? `<div><strong>Patient:</strong> ${esc(patient)}</div>` : ''}
      <div class="muted">Period: ${esc(range)}</div>
    </div>
    <div class="muted small">Generated ${esc(new Date(generatedAt).toLocaleString())}</div>
  </div>

  <h2>30-day adherence</h2>
  <div class="stats">
    <div class="stat"><div class="label">Adherence</div><div class="value">${pct(summary.percent)}</div></div>
    <div class="stat"><div class="label">Taken</div><div class="value" style="color:${SUCCESS}">${summary.taken}</div></div>
    <div class="stat"><div class="label">Skipped</div><div class="value" style="color:${WARNING}">${summary.skipped}</div></div>
    <div class="stat"><div class="label">Missed</div><div class="value" style="color:${DANGER}">${summary.missed}</div></div>
  </div>
  ${
    total
      ? `${chartSvg(summary)}
  <div class="legend">
    <span><span class="swatch" style="background:${SUCCESS}"></span>80% or more</span>
    <span><span class="swatch" style="background:${WARNING}"></span>50–79%</span>
    <span><span class="swatch" style="background:${DANGER}"></span>Under 50%</span>
    <span>No bar: no doses due</span>
  </div>`
      : `<p class="muted">No doses were due in this period.</p>`
  }

  <h2>Active medications</h2>
  <table>
    <thead><tr><th>Medication</th><th>Dosage</th><th>Schedule</th><th class="num">Taken</th><th class="num">Skipped</th><th class="num">Missed</th><th class="num">Adherence</th></tr></thead>
    <tbody>${medsRows}</tbody>
  </table>

  <h2>Hospital &amp; clinic visits</h2>
  <table>
    <thead><tr><th>Date</th><th>Facility</th><th>Doctor</th><th>Reason / notes</th></tr></thead>
    <tbody>${visitRows}</tbody>
  </table>

  <div class="footer">
    Adherence = doses taken ÷ doses due. A scheduled dose with nothing logged by the end of its day counts as missed.
    Doses due later today are not included. Self-reported by the patient in the app.
  </div>
</body>
</html>`;
}

/** Every logged visit, newest first. */
export function fetchVisits(database: Database) {
  return database.get<VisitRecord>('visits').query(Q.sortBy('visited_at', Q.desc)).fetch();
}

/**
 * Renders the report to a PDF and opens the share sheet. Throws an Error with a user-facing message.
 * Resolves once the share sheet is dismissed.
 */
export async function exportReportPdf(
  database: Database,
  { summary, patient }: { summary: AdherenceSummary; patient?: string },
) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const visits = await fetchVisits(database);
  const html = buildReportHtml({ summary, visits, patient });
  const { uri } = await Print.printToFileAsync({
    html,
    ...PAGE,
    // iOS ignores @page margins; Android uses them.
    margins: { top: 36, right: 36, bottom: 36, left: 36 },
  });

  // Give the file a readable name so it arrives as e.g. "Medication-report-2026-11-15.pdf".
  const shareUri = await renameForSharing(uri);
  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share medication report',
  });
}

async function renameForSharing(uri: string) {
  try {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const target = new File(Paths.cache, `Medication-report-${stamp}.pdf`);
    if (target.exists) target.delete();
    const file = new File(uri);
    await file.move(target);
    return file.uri;
  } catch {
    // Sharing the generated file under its random name is still fine.
    return uri;
  }
}
