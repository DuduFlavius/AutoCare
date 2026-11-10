import { financeGroup } from './finance-overview';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export async function vehicleReport({
  vehicles,
  records,
  generatedAt,
}: {
  vehicles: Array<{ id: string; brand: string; model: string; plate: string; odometer: number }>;
  records: Array<{
    vehicleId: string;
    kind: string;
    title: string;
    category: string;
    date: string | null;
    expiresAt: string | null;
    nextKm: number | null;
    odometer: number | null;
    amountBani: number;
    amountKnown: boolean;
    provider: string | null;
    notes: string | null;
    parts: string | null;
  }>;
  generatedAt: string;
}) {
  const doc = await PDFDocument.create(),
    regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle('AutoCare - Raport auto');
  doc.setAuthor('AutoCare');
  let page = doc.addPage([595.28, 841.89]),
    y = 0,
    index = 0;
  const clean = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E\n]/g, '?');
  const fresh = () => {
    if (index > 0) page = doc.addPage([595.28, 841.89]);
    index++;
    page.drawRectangle({ x: 0, y: 759, width: 596, height: 83, color: rgb(0.07, 0.15, 0.26) });
    page.drawRectangle({ x: 0, y: 759, width: 596, height: 3, color: rgb(0.22, 0.55, 1) });
    page.drawText('MIDNIGHT TITANIUM', { x: 437, y: 810, size: 9, font: bold, color: rgb(0.62, 0.80, 1) });
    page.drawText('AutoCare', { x: 36, y: 803, size: 20, font: bold, color: rgb(1, 1, 1) });
    page.drawText('RAPORT AUTO | ' + clean(generatedAt), {
      x: 36,
      y: 781,
      size: 9,
      font: regular,
      color: rgb(0.75, 0.83, 0.94),
    });
    page.drawText('Date inregistrate de utilizator | Sume in RON', {
      x: 36,
      y: 24,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.46, 0.55),
    });
    page.drawText(String(index), {
      x: 548,
      y: 24,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.46, 0.55),
    });
    y = 730;
  };
  fresh();
  const text = (value: string, heading = false) => {
    const font = heading ? bold : regular,
      size = heading ? 12 : 9;
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const pieces = word.match(/.{1,40}/g) || [''];
        for (const piece of pieces) {
          const next = (line ? line + ' ' : '') + piece;
          if (font.widthOfTextAtSize(next, size) > 519 && line) {
            if (y < 55) fresh();
            page.drawText(line, { x: 38, y, size, font, color: rgb(0.12, 0.2, 0.31) });
            y -= 15;
            line = piece;
          } else line = next;
        }
      }
      if (y < 55) fresh();
      page.drawText(line, { x: 38, y, size, font, color: rgb(0.12, 0.2, 0.31) });
      y -= heading ? 22 : 15;
    }
  };
  text('Sinteza garajului', true);
  const known = records.filter(row => row.amountKnown);
  const total = known.reduce((sum, row) => sum + row.amountBani, 0);
  const tiles = [
    ['Vehicule', String(vehicles.length)],
    ['Inregistrari', String(records.length)],
    ['Cost in selectie', known.length ? (total / 100).toFixed(2) + ' RON' : 'Necompletat'],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 36 + i * 176;
    page.drawRectangle({ x, y: y - 49, width: 168, height: 55, color: rgb(0.94, 0.96, 0.99), borderWidth: 1, borderColor: rgb(0.84, 0.89, 0.96) });
    page.drawText(label, { x: x + 10, y: y - 12, size: 9, font: regular, color: rgb(0.28, 0.35, 0.46) });
    page.drawText(value, { x: x + 10, y: y - 34, size: 14, font: bold, color: rgb(0.11, 0.24, 0.42) });
  });
  y -= 67;
  text('Costurile necunoscute sunt excluse. Raportul nu este o factura sau o expertiza tehnica.');
  const costsByGroup = new Map<string, number>();
  for (const row of known) {
    const group = financeGroup(row);
    costsByGroup.set(group, (costsByGroup.get(group) ?? 0) + row.amountBani);
  }
  if (total > 0) {
    y -= 9;
    text('Distributia costurilor', true);
    for (const [group, amount] of [...costsByGroup].filter(([, value]) => value > 0).sort((a,b) => b[1] - a[1])) {
      page.drawText(clean(group), { x: 38, y, size: 9, font: regular, color: rgb(0.12, 0.2, 0.31) });
      page.drawRectangle({ x: 134, y: y - 1, width: 282, height: 7, color: rgb(0.9, 0.93, 0.97) });
      page.drawRectangle({ x: 134, y: y - 1, width: 282 * amount / total, height: 7, color: rgb(0.22, 0.55, 1) });
      page.drawText((amount / 100).toFixed(2) + ' RON', { x: 430, y, size: 9, font: bold, color: rgb(0.12, 0.2, 0.31) });
      y -= 18;
    }
  }
  y -= 12;
  for (const car of vehicles) {
    const rows = records
      .filter((r) => r.vehicleId === car.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!rows.length) continue;
    if (y < 125) fresh();
    text(car.brand + ' ' + car.model + ' | ' + car.plate, true);
    text('Kilometraj confirmat in cont: ' + car.odometer.toLocaleString('ro-RO') + ' km');
    y -= 6;
    for (const r of rows) {
      if (y < 125) fresh();
      page.drawLine({ start: { x: 37, y: y + 9 }, end: { x: 557, y: y + 9 }, color: rgb(0.86, 0.91, 0.97), thickness: 0.7 });
      text((r.date || 'Data necompletata') + ' | ' + r.title, true);
      text(
        r.kind +
          ' | ' +
          r.category +
          ' | ' +
          (r.amountKnown ? (r.amountBani / 100).toFixed(2) + ' RON' : 'Cost necunoscut'),
      );
      if (r.odometer !== null) text('Kilometraj interventie: ' + r.odometer + ' km');
      if (r.nextKm !== null || r.expiresAt)
        text(
          'Urmatorul prag: ' +
            (r.nextKm === null ? '' : r.nextKm + ' km') +
            (r.expiresAt ? ' | ' + r.expiresAt : ''),
        );
      if (r.provider) text('Service / emitent: ' + r.provider);
      if (r.parts)
        text(
          'Piese / detalii: ' +
            r.parts
              .split('\n')
              .map((line) => {
                if (!line.startsWith('AutoCare · ')) return line;
                const raw = line.slice(11),
                  position = raw.indexOf(': ');
                if (position < 0) return '';
                const key = raw.slice(0, position),
                  value = raw.slice(position + 2);
                const labels: Record<string, string> = {
                  intervalUlei: 'Interval ulei (km)',
                  intervalDistributie: 'Interval distributie (km)',
                  intervalIntretinere: 'Interval interventii (km)',
                  intervalLuni: 'Interval (luni)',
                  alertDays: 'Alerte inainte (zile)',
                  alertKm: 'Alerte inainte (km)',
                };
                return (
                  (labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2')) +
                  ': ' +
                  (value === 'none' ? 'dezactivate' : value)
                );
              })
              .filter(Boolean)
              .join('\n'),
        );
      if (r.notes) text('Observatii: ' + r.notes);
      y -= 12;
    }
  }
  return Buffer.from(await doc.save());
}
