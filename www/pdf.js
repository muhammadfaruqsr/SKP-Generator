/* pdf.js — Generate PDF F4 client-side menggunakan pdf-lib */
/* Library pdf-lib di-load via CDN di index.html */

const F4_W = 609.4;
const F4_H = 935.4;
const MARGIN = 28;
const FS = 9.5;
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum’at','Sabtu'];

function tglIndo(s) {
  const [y, m, d] = s.split('-').map(Number);
  return d + ' ' + BULAN[m - 1] + ' ' + y;
}
function hariTgl(s) {
  const [y, m, d] = s.split('-').map(Number);
  return HARI[new Date(y, m - 1, d).getDay()] + ', ' + tglIndo(s);
}
function bersihTanggal(w) {
  const H = '(?:senin|selasa|rabu|kamis|jum[\'\u2019`]?at|sabtu|minggu|ahad)';
  const M = '(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*\\.?';
  const pre = '(?:\\b' + H + '\\s*[,.]?\\s*)?';
  const res = [
    new RegExp(pre + '\\b\\d{1,2}\\s+' + M + '(?:\\s+\\d{4})?', 'gi'),
    new RegExp(pre + '\\b\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4}\\b', 'gi'),
    new RegExp(pre + '\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2}\\b', 'gi'),
    new RegExp(pre + '\\b\\d{4}-\\d{2}-\\d{2}\\b', 'gi')
  ];
  let s = String(w || '');
  res.forEach((re) => { s = s.replace(re, ''); });
  return s.split(/\r?\n/).map((l) => l.replace(/\(\s*\)/g, '').replace(/[\s,;:\-\u2013]+$/, '').replace(/^[\s,;:]+/, '').trim()).filter((l) => l).join('\n');
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function buildPdf(data, profil) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle('SKP Harian ' + data.tanggal);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([F4_W, F4_H]);
  const CONTENT_W = F4_W - MARGIN * 2;
  const W0 = 115, W1 = 12;
  const W2 = CONTENT_W - W0 - W1;
  let y = F4_H - MARGIN;

  const drawText = (txt, x, y0, opts = {}) => {
    const size = opts.size || FS;
    const f = opts.bold ? fontBold : font;
    const color = opts.color || rgb(0, 0, 0);
    const maxW = opts.maxW || 9999;
    const lines = wrapText(String(txt || ''), f, size, maxW);
    let cy = y0;
    for (const line of lines) {
      page.drawText(line, { x, y: cy - size, size, font: f, color });
      cy -= size * 1.18;
    }
    return cy;
  };

  const wrapText = (text, f, size, maxW) => {
    if (!text) return [''];
    const out = [];
    for (const para of text.split(/\r?\n/)) {
      if (!para) { out.push(''); continue; }
      const words = para.split(/\s+/);
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) <= maxW) {
          line = test;
        } else {
          if (line) out.push(line);
          if (f.widthOfTextAtSize(w, size) > maxW) {
            let chunk = '';
            for (const ch of w) {
              if (f.widthOfTextAtSize(chunk + ch, size) > maxW) { out.push(chunk); chunk = ch; }
              else chunk += ch;
            }
            line = chunk;
          } else line = w;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  /* ---- Tabel profil + logo ---- */
  const profRows = [
    ['Nama', ':', profil.nama || ''],
    ['NIP', ':', profil.nip || ''],
    ['Pangkat/Gol. Ruang', ':', profil.pangkat || ''],
    ['Jabatan', ':', profil.jabatan || ''],
    ['Unit Kerja', ':', profil.unit || ''],
    ['Atasan', ':', profil.atasan || '']
  ];
  const rowH = 16;
  const headerH = profRows.length * rowH + 6;
  page.drawRectangle({ x: MARGIN, y: y - headerH, width: CONTENT_W, height: headerH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
  /* Logo cell */
  page.drawLine({ start: { x: MARGIN + W0, y: y - headerH }, end: { x: MARGIN + W0, y }, thickness: 0.75, color: rgb(0, 0, 0) });
  /* Inner table lines */
  let cy = y - 4;
  for (let i = 0; i < profRows.length; i++) {
    const [label, colon, val] = profRows[i];
    drawText(label, MARGIN + W0 + 6, cy, { size: FS, maxW: 100 });
    drawText(colon, MARGIN + W0 + 112, cy, { size: FS });
    drawText(val, MARGIN + W0 + 124, cy, { size: FS, maxW: CONTENT_W - W0 - 130 });
    cy -= rowH;
    if (i < profRows.length - 1) {
      page.drawLine({ start: { x: MARGIN + W0, y: cy + 4 }, end: { x: MARGIN + CONTENT_W, y: cy + 4 }, thickness: 0.5, color: rgb(0, 0, 0) });
    }
  }
  /* Logo */
  if (profil.logoPreview) {
    try {
      const bytes = b64ToBytes(profil.logoPreview.split(',')[1]);
      const img = profil.logoPreview.includes('image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxW = 95, maxH = 95;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      page.drawImage(img, {
        x: MARGIN + (W0 - img.width * scale) / 2,
        y: y - headerH + (headerH - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale
      });
    } catch (e) { console.warn('logo gagal', e); }
  }
  y -= headerH + 8;

  /* ---- Tabel isi ---- */
  let waktu = String(data.waktu || '').trim();
  if (data.autoTanggal !== false) {
    waktu = bersihTanggal(waktu);
    waktu = (waktu ? waktu + '\n' : '') + hariTgl(data.tanggal);
  }
  const isiRows = [
    ['Jenis RHK', data.rhkLabel ? data.rhkLabel + ': ' + data.rhk : data.rhk],
    ['Waktu Pelaksanaan', waktu],
    ['Jenis Kegiatan', data.kegiatan],
    ['Output yang di hasilkan', data.output]
  ];
  const rowHeights = isiRows.map(([label, val]) => {
    const lh = wrapText(val, font, FS, W2 - 10).length * FS * 1.18 + 8;
    return Math.max(lh, 20);
  });
  for (let i = 0; i < isiRows.length; i++) {
    const h = rowHeights[i];
    const [label, val] = isiRows[i];
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawLine({ start: { x: MARGIN + W0, y: y - h }, end: { x: MARGIN + W0, y }, thickness: 0.75, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: MARGIN + W0 + W1, y: y - h }, end: { x: MARGIN + W0 + W1, y }, thickness: 0.75, color: rgb(0, 0, 0) });
    drawText(label, MARGIN + 4, y - 4, { size: FS, maxW: W0 - 8 });
    drawText(':', MARGIN + W0 + 3, y - 4, { size: FS });
    drawText(val, MARGIN + W0 + W1 + 3, y - 4, { size: FS, maxW: W2 - 8 });
    y -= h;
  }

  /* ---- Dokumentasi (halaman 2) ---- */
  if (data.fotos && data.fotos.length) {
    const p2 = doc.addPage([F4_W, F4_H]);
    const oldPage = page;
    /* switch drawing context ke p2 */
    const p2y0 = F4_H - MARGIN;
    p2.drawRectangle({ x: MARGIN, y: p2y0 - 20, width: CONTENT_W, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    p2.drawText('Dokumentasi', { x: MARGIN + 4, y: p2y0 - 14, size: FS, font });
    p2.drawText(':', { x: MARGIN + W0 + 3, y: p2y0 - 14, size: FS, font });
    let imgY = p2y0 - 24;
    let imgX = MARGIN + W0 + W1 + 4;
    const gw = (W2 - 12) / 2;
    for (let i = 0; i < data.fotos.length; i++) {
      try {
        const bytes = b64ToBytes(data.fotos[i].b64);
        const img = data.fotos[i].mime === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const scale = Math.min((gw - 8) / img.width, 150 / img.height);
        const w = img.width * scale, h = img.height * scale;
        if (i % 2 === 0 && i > 0) { imgY -= 160; imgX = MARGIN + W0 + W1 + 4; }
        p2.drawImage(img, { x: imgX, y: imgY - h, width: w, height: h });
        imgX += gw;
      } catch (e) { console.warn('foto gagal', e); }
    }
  }

  /* ---- Tanda tangan ---- */
  const sigPage = page;
  const BLOCK_W = 230;
  const X = CONTENT_W - BLOCK_W - 6 + MARGIN;
  const tmp = (data.tempat || profil.tempat || '').trim();
  y -= 20;
  sigPage.drawText((tmp ? tmp + ', ' : '') + tglIndo(data.tanggalSurat || data.tanggal), { x: X, y: y - FS, size: FS, font });
  y -= FS * 1.5;
  sigPage.drawText('Dibuat Oleh', { x: X, y: y - FS, size: FS, font });
  y -= FS * 1.5;
  if (data.sertakanTtd !== false && profil.ttdPreview) {
    try {
      const bytes = b64ToBytes(profil.ttdPreview.split(',')[1]);
      const img = profil.ttdPreview.includes('image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = Math.min((BLOCK_W - 40) / img.width, 70 / img.height);
      sigPage.drawImage(img, { x: X + 6, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
      y -= img.height * scale + 4;
    } catch (e) { y -= 40; }
  } else {
    y -= 40;
  }
  sigPage.drawText(profil.nama || '', { x: X, y: y - FS, size: FS, font });
  y -= FS * 1.5;
  sigPage.drawText('NIP.' + (profil.nip || ''), { x: X, y: y - FS, size: FS, font });

  return await doc.save();
}

async function downloadPdf(data, profil) {
  const bytes = await buildPdf(data, profil);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SKP Harian ' + data.tanggal + (profil.nama ? ' - ' + profil.nama.replace(/[\\\/:*?"<>|]/g, '') : '') + '.pdf';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  return bytes;
}
