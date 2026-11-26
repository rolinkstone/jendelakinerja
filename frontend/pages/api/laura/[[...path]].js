// pages/api/laura/[[...path]].js
/**
 * PROXY LAURA AI — jalur publik, same-origin
 * ------------------------------------------
 *   browser (halaman /jendela-kinerja)
 *     → /api/laura/<path>            (tanpa cookie sesi, tanpa CORS)
 *       → LAURA backend /api/public/<path>
 *
 * Kenapa lewat proxy, bukan fetch langsung ke LAURA:
 *  1. Browser tidak perlu tahu alamat LAURA (bisa berubah tanpa build ulang).
 *  2. Same-origin → tidak perlu izin CORS tambahan di LAURA.
 *  3. Balasan SELALU JSON — kalau LAURA mati, pengguna melihat pesan jelas,
 *     bukan error "Unexpected token '<'" seperti kasus link-api sebelumnya.
 *
 * Keamanan: hanya rute publik LAURA yang boleh lewat sini. Daftar putih
 * menjaga proxy ini tidak menjadi jalan pintas ke endpoint admin LAURA.
 */
import { BACKEND as BACKEND_JK } from '../../../utils/backendUrl';
import { balasKosong } from '../../../utils/balasBackend';

/** Backend LAURA (bukan backend JK). */
const BACKEND = (process.env.LAURA_API_URL || 'http://localhost:5005/api').replace(/\/+$/, '');

/** Kolom filter yang membentuk kunci koreksi (sama dengan backend lib/narasi.js). */
const KOLOM_FILTER = ['tahun', 'bulan', 'kegiatan', 'jenis', 'kab'];

/**
 * Cari koreksi naskah presentasi untuk filter tertentu.
 * @returns {Promise<object|null>} data koreksi, atau null bila belum ada
 */
const cariKoreksi = async (filter) => {
  if (!filter) return null;
  const q = new URLSearchParams();
  for (const k of KOLOM_FILTER) {
    const v = filter[k];
    if (v !== '' && v !== null && v !== undefined) q.set(k, String(v));
  }
  const qs = q.toString();
  try {
    const r = await fetch(`${BACKEND_JK}/narasi-presentasi/aktif${qs ? `?${qs}` : ''}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.success ? j.data : null;
  } catch (e) {
    // Koreksi tidak wajib: backend JK mati → tetap lanjut ke LAURA.
    return null;
  }
};

/**
 * Rute LAURA yang boleh diakses dari halaman publik JK.
 * Menambah entri di sini = membuka jalur baru dari internet, jadi eksplisit.
 */
const RUTE_DIIZINKAN = new Set([
  'chat',          // POST — tanya jawab RAG (tamu, tanpa login)
  'chat/stream',   // POST — versi streaming
  'presentasi',    // POST — naskah narasi dashboard
  'feedback',      // POST — umpan balik jawaban
]);

/** Batas waktu panggilan ke LAURA (ms). LLM bisa lambat, jangan terlalu ketat. */
const BATAS_MS = 90000;

/** Kirim JSON apa pun ke browser — tidak pernah HTML. */
const balasJson = (res, status, obj) => {
  res.status(status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.send(JSON.stringify(obj));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return balasJson(res, 405, { success: false, message: 'Hanya method POST yang diizinkan' });
  }

  const bagian = [].concat(req.query.path || []).join('/');

  if (!bagian) {
    return balasJson(res, 404, { success: false, message: 'Rute LAURA tidak disebutkan' });
  }

  if (!RUTE_DIIZINKAN.has(bagian)) {
    // Jangan bocorkan rute apa yang ada — cukup tolak.
    return balasJson(res, 403, {
      success: false,
      message: 'Rute ini tidak dibuka untuk halaman publik. Hubungi admin bila diperlukan.',
    });
  }

  const url = `${BACKEND}/public/${bagian}`;
  const batas = AbortSignal.timeout ? AbortSignal.timeout(BATAS_MS) : undefined;

  // PRESENTASI: koreksi operator (bila ada) MENANG atas naskah otomatis.
  // Filter diambil dari body.filter; kalau tidak dikirim, pakai filter yang
  // tercatat di payload dashboard. Tanpa koreksi → lanjut ke LAURA AI.
  if (bagian === 'presentasi') {
    const filter = (req.body && req.body.filter) || (req.body?.dashboard && req.body.dashboard.filter) || null;
    const koreksi = await cariKoreksi(filter);
    if (koreksi) {
      return balasJson(res, 200, {
        success: true,
        data: {
          naskah: koreksi.naskah,
          sumber: 'koreksi',
          catatan: koreksi.catatan || null,
          jumlah_kata: koreksi.jumlah_kata,
          perkiraan_detik: Math.max(20, Math.round((koreksi.jumlah_kata / 150) * 60)),
          diubah_oleh: koreksi.diubah_oleh,
          diubah_pada: koreksi.diubah_pada,
          label_filter: koreksi.label,
        },
      });
    }
  }

  try {
    const jawaban = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Body diteruskan apa adanya (Next sudah mem-parse; kirim ulang sebagai JSON).
      body: JSON.stringify(req.body || {}),
      signal: batas,
    });

    const teks = await jawaban.text();

    if (req.method !== 'HEAD' && !teks.trim()) return balasKosong(res, jawaban, url);
    const tipe = jawaban.headers.get('content-type') || '';

    // Balasan LAURA yang bukan JSON (mis. halaman error HTML dari reverse proxy)
    // dibungkus jadi JSON — kelas bug "Unexpected token '<'" tidak boleh terulang.
    if (!tipe.includes('application/json')) {
      return balasJson(res, 502, {
        success: false,
        message: `LAURA membalas bukan JSON (${jawaban.status}). Periksa layanan LAURA di ${BACKEND}.`,
        cuplikan: teks.slice(0, 300).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
    }

    let data;
    try {
      data = JSON.parse(teks);
    } catch (e) {
      return balasJson(res, 502, {
        success: false,
        message: 'Balasan LAURA tidak bisa dibaca sebagai JSON.',
      });
    }

    return balasJson(res, jawaban.status, data);
  } catch (e) {
    const habisWaktu = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return balasJson(res, habisWaktu ? 504 : 502, {
      success: false,
      message: habisWaktu
        ? 'LAURA tidak merespons dalam 90 detik. Coba lagi.'
        : `Gagal menghubungi LAURA (${BACKEND}): ${e.message}`,
    });
  }
}
