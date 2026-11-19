/* app.js — logika utama SKP Harian Offline */

const ICONS = { /* sama seperti versi GAS */ };
const ic = (n) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
function hydrate(root) { (root || document).querySelectorAll('[data-ic]').forEach(e => { if (!e.dataset.done) { e.insertAdjacentHTML('afterbegin', ic(e.dataset.ic)); e.dataset.done = 1; } }); }

const CATS = [ /* sama */ ];
const BLN_FULL = [ /* sama */ ];
const HARI3 = [ /* sama */ ];
const S = { profil: {}, settings: { rhk: [], waktu: [] }, riwayat: [], photos: [], cat: 'rhk', logo: null, ttd: null, rmLogo: false, rmTtd: false };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }

/* ============ INIT ============ */
(async function init() {
  hydrate();
  try {
    // Load dari IndexedDB
    S.profil = (await dbGetOne('profil')) || {};
    S.settings = (await dbGetOne('settings')) || { rhk: [], waktu: [] };
    S.riwayat = await dbGetAll('riwayat');
    // Load jadwal untuk bulan ini
    const ym = todayStr().slice(0, 7);
    AB.data = (await dbGetAll('absen')).filter(x => x.tanggal.startsWith(ym));
    MK.data = (await dbGetAll('masuk')).filter(x => x.tanggal.startsWith(ym));
  } catch (e) {
    $('#boot-t').innerHTML = 'Gagal memuat: ' + esc(e.message);
    return;
  }
  const t = todayStr();
  $('#f-tanggal').value = t;
  $('#f-tempat').value = S.profil.tempat || '';
  renderWho();
  buildFields();
  renderThumbs();
  hydrate();
  $('#boot').style.display = 'none';
})();

/* ============ SIMPAN PROFIL ============ */
$('#p-save').onclick = async () => {
  const p = { id: 'main', share: $('#p-share') ? $('#p-share').checked : false };
  ['nama', 'nip', 'pangkat', 'jabatan', 'unit', 'atasan', 'tempat'].forEach(k => p[k] = $('#p-' + k).value);
  if (S.logo) p.logoPreview = S.logo.dataUrl;
  if (S.ttd) p.ttdPreview = S.ttd.dataUrl;
  if (S.rmLogo) p.logoPreview = '';
  if (S.rmTtd) p.ttdPreview = '';
  await dbPut('profil', p);
  S.profil = p;
  S.logo = S.ttd = null;
  S.rmLogo = S.rmTtd = false;
  renderWho();
  renderUploads();
  toast('Profil tersimpan ✓');
};

/* ============ GENERATE PDF ============ */
$('#btn-gen').onclick = async () => {
  const d = collect();
  if (!d) return;
  const b = $('#btn-gen');
  b.disabled = true;
  b.innerHTML = '<div class="spin"></div><span>Membuat PDF…</span>';
  try {
    const bytes = await downloadPdf(d, S.profil);
    // Simpan ke riwayat
    const item = {
      id: Date.now().toString(),
      tanggal: d.tanggal,
      label: hariTgl(d.tanggal),
      rhk: (d.rhkLabel ? d.rhkLabel + ' · ' : '') + d.rhk,
      url: '',
      dibuat: new Date().toISOString()
    };
    await dbPut('riwayat', item);
    S.riwayat.push(item);
    $('#r-name').textContent = 'File PDF telah diunduh ke perangkat Anda';
    $('#result').style.display = 'block';
    toast('PDF berhasil dibuat & diunduh ✓');
    // Simpan bytes untuk upload Drive nanti
    $('#r-download').onclick = () => downloadPdf(d, S.profil);
    $('#r-drive').onclick = () => uploadToDrive(bytes, d, S.profil);
  } catch (e) {
    toast('Gagal: ' + e.message);
  } finally {
    b.disabled = false;
    b.innerHTML = ic('file') + '<span>Buat PDF</span>';
  }
};

/* ============ UPLOAD KE DRIVE (opsional) ============ */
async function uploadToDrive(bytes, data, profil) {
  if (!window.gapi || !window.google) {
    toast('Google API belum dimuat');
    return;
  }
  try {
    const token = await getGoogleToken();
    const metadata = {
      name: 'SKP Harian ' + data.tanggal + (profil.nama ? ' - ' + profil.nama.replace(/[\\\/:*?"<>|]/g, '') : '') + '.pdf',
      mimeType: 'application/pdf'
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([bytes], { type: 'application/pdf' }));
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form
    });
    const json = await res.json();
    if (json.id) {
      toast('Berhasil disimpan ke Drive ✓');
      window.open('https://drive.google.com/file/d/' + json.id + '/view', '_blank');
    } else {
      toast('Gagal: ' + (json.error?.message || 'unknown'));
    }
  } catch (e) {
    toast('Gagal upload: ' + e.message);
  }
}

let _tokenClient = null;
function getGoogleToken() {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: 'PASTE_GOOGLE_CLIENT_ID_DI_SINI',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          resolve(resp.access_token);
        }
      });
    }
    _tokenClient.requestAccessToken();
  });
}

/* ============ SISA LOGIKA ============ */
/* Salin dari versi GAS: go(), buildFields(), fillSelects(), renderThumbs(), collect(),
   previewHtml(), fitPv(), openPv(), closePv(), renderRiwayat(), renderSetting(),
   renderAbsen(), renderMasuk(), fillProfil(), renderUploads(), dll.
   Ganti semua panggilan api('xxx', ...) dengan dbPut/dbGet/dbGetAll yang sesuai. */
