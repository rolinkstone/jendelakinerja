// components/beranda/IntegrasiLauraContainer.js
/**
 * PENGELOLA LINK API — INTEGRASI LAURA AI (dashboard ber-SSO)
 * ----------------------------------------------------------
 * Halaman ini adalah TEMPAT MENERBITKAN dan MENGELOLA link API:
 *
 *   1. Pilih modul -> centang field yang boleh keluar -> terbitkan link.
 *   2. Tabel link: salin ulang, ubah publik <-> private, hapus.
 *
 * Kenapa di dashboard internal, bukan di halaman publik: link API adalah
 * detail teknis integrasi. Data publik di /jendela-kinerja memakai route
 * /api/publik/kinerja/* yang TERPISAH -- biarkan publik, tidak terpengaruh
 * apa pun yang diatur di halaman ini.
 *
 * Visibilitas link:
 *   publik  -> siapa pun yang memegang link boleh menarik data (tanpa token).
 *   private -> wajib Bearer Keycloak saat menarik data. LAURA AI mendukung
 *              keduanya (kolom auth_mode per endpoint).
 *
 * Token disegel di server (AES-256-GCM), jadi link bisa disalin ulang tanpa
 * menyimpan plaintext di database.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaCode,
  FaCopy,
  FaCheck,
  FaSyncAlt,
  FaLink,
  FaInfoCircle,
  FaLock,
  FaGlobe,
  FaTrash,
  FaPlus,
  FaTimes,
  FaSave,
} from 'react-icons/fa';

const BADGE_VISIBILITAS = {
  publik: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  private: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

const BADGE_STATUS = {
  aktif: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  segera_kedaluwarsa: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  kedaluwarsa: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  dicabut: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
};

const LABEL_STATUS = {
  aktif: 'aktif',
  segera_kedaluwarsa: 'segera kedaluwarsa',
  kedaluwarsa: 'kedaluwarsa',
  dicabut: 'dihapus',
};

const tanggal = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Dua pilihan visibilitas, dirender sebagai kartu radio. */
const PILIHAN_VISIBILITAS = [
  {
    id: 'publik',
    judul: 'Publik',
    ket: 'Siapa pun yang memegang link boleh menarik data.',
    Ikon: FaGlobe,
  },
  {
    id: 'private',
    judul: 'Private',
    ket: 'Wajib Bearer Keycloak saat menarik data.',
    Ikon: FaLock,
  },
];

export default function IntegrasiLauraContainer() {
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(null);
  const [pesan, setPesan] = useState(null);
  const [data, setData] = useState(null);
  const [katalogModul, setKatalogModul] = useState(null);
  const [tersalin, setTersalin] = useState(null);

  // Form terbitkan link
  const [bukaForm, setBukaForm] = useState(false);
  const [modul, setModul] = useState('sampel-ot');
  const [kolomPilih, setKolomPilih] = useState([]);
  const [tahun, setTahun] = useState('');
  const [limit, setLimit] = useState('500');
  const [label, setLabel] = useState('');
  const [masaBerlaku, setMasaBerlaku] = useState('30');
  const [visibilitas, setVisibilitas] = useState('publik');

  // ===== Data publik /jendela-kinerja (rute /api/publik/kinerja/*) =====
  const [publik, setPublik] = useState(null);
  const [publikMemuat, setPublikMemuat] = useState(true);
  const [publikGalat, setPublikGalat] = useState(null);

  const ambilPublik = useCallback(async () => {
    setPublikMemuat(true);
    setPublikGalat(null);
    try {
      const res = await fetch('/api/publik/kinerja/api-modul', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal memuat katalog publik');
      setPublik(json.data);
    } catch (e) {
      setPublikGalat(e.message);
    } finally {
      setPublikMemuat(false);
    }
  }, []);

  useEffect(() => {
    ambilPublik();
  }, [ambilPublik]);

  const publikModul = publik?.modul || [];

  // Pencarian sederhana pada tabel data publik
  const [saringPublik, setSaringPublik] = useState('');
  const publikTersaring = useMemo(() => {
    const q = saringPublik.trim().toLowerCase();
    if (!q) return publikModul;
    return publikModul.filter((m) =>
      [m.kode, m.nama, m.halaman, m.url_path, m.modul, m.keterangan]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [publikModul, saringPublik]);

  const ambilDaftar = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch('/api/link-api', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal memuat daftar link');
      setData(json.data);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, []);

  const ambilKatalog = useCallback(async (kode) => {
    try {
      const res = await fetch(`/api/link-api/modul/${encodeURIComponent(kode)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal memuat field modul');
      setKatalogModul(json.data);
      setKolomPilih(json.data.saran_kolom || []);
    } catch (e) {
      setGalat(e.message);
      setKatalogModul(null);
    }
  }, []);

  useEffect(() => {
    ambilDaftar();
  }, [ambilDaftar]);

  useEffect(() => {
    if (bukaForm) ambilKatalog(modul);
  }, [bukaForm, modul, ambilKatalog]);

  const link = data?.link || [];

  const ringkas = useMemo(() => {
    const publik = link.filter((l) => l.visibilitas === 'publik' && l.status !== 'dicabut').length;
    const privat = link.filter((l) => l.visibilitas === 'private' && l.status !== 'dicabut').length;
    const akses = link.reduce((n, l) => n + (Number(l.jumlah_akses) || 0), 0);
    return { publik, privat, akses };
  }, [link]);

  const salin = async (teks, kunci) => {
    if (!teks) return;
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = teks;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setTersalin(kunci);
    setTimeout(() => setTersalin((k) => (k === kunci ? null : k)), 1600);
  };

  const ubahVisibilitas = async (l) => {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    const baru = l.visibilitas === 'private' ? 'publik' : 'private';
    try {
      const res = await fetch(`/api/link-api/${l.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibilitas: baru }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal mengubah visibilitas');
      setPesan(`Link #${l.id} sekarang ${baru}.`);
      await ambilDaftar();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async (l) => {
    const yakin = window.confirm(
      `Hapus link #${l.id} (${l.nama_modul})?\n\nLink langsung tidak berlaku. LAURA AI yang sudah memakainya akan gagal sinkron.`
    );
    if (!yakin) return;
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const res = await fetch(`/api/link-api/${l.id}?permanen=1`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal menghapus link');
      setPesan(`Link #${l.id} dihapus.`);
      await ambilDaftar();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  };

  const terbitkan = async (e) => {
    e.preventDefault();
    setGalat(null);
    setPesan(null);
    if (!kolomPilih.length) {
      setGalat('Pilih minimal satu field yang boleh keluar');
      return;
    }
    setSibuk(true);
    try {
      const res = await fetch('/api/link-api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modul,
          kolom: kolomPilih,
          label: label || null,
          visibilitas,
          masa_berlaku_hari: Number(masaBerlaku) || 30,
          filter: { tahun: tahun || undefined, limit: Number(limit) || 500 },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal menerbitkan link');
      setPesan(json.message || 'Link diterbitkan');
      setBukaForm(false);
      setLabel('');
      await ambilDaftar();
      if (json.data?.link) salin(json.data.link, `baru-${json.data.id}`);
    } catch (e2) {
      setGalat(e2.message);
    } finally {
      setSibuk(false);
    }
  };

  const toggleKolom = (nama) =>
    setKolomPilih((dulu) =>
      dulu.includes(nama) ? dulu.filter((k) => k !== nama) : [...dulu, nama]
    );

  return (
    <div className="space-y-5">
      {/* ============ Judul ============ */}
      <section className="panel overflow-hidden">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <span className="chip chip-accent">
              <FaCode className="h-3 w-3" />
              Integrasi knowledge
            </span>
            <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Link API untuk LAURA AI
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              Pilih modul dan field yang boleh keluar, lalu terbitkan link. Tempel link itu di{' '}
              <strong>LAURA AI - Integrasi JK</strong> dan tekan <strong>Sinkron</strong>. Link bisa
              diubah menjadi <strong>publik</strong> atau <strong>private</strong>, dan bisa dihapus
              kapan saja.
            </p>
            <p className="mt-2 text-[11.5px] text-slate-400">
              Data di halaman publik <strong>/jendela-kinerja</strong> tetap publik - halaman itu
              memakai route <code>/api/publik/kinerja/*</code> yang terpisah dari fitur link ini.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-paper-200 bg-paper-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            {[
              { label: 'Publik', nilai: ringkas.publik, kelas: 'text-emerald-600' },
              { label: 'Private', nilai: ringkas.privat, kelas: 'text-amber-600' },
              { label: 'Akses', nilai: ringkas.akses, kelas: 'text-accent-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-extrabold ${s.kelas}`}>{s.nilai}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-paper-200 px-5 py-3 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setBukaForm(true)}
            className="btn-primary-sm inline-flex items-center gap-2"
          >
            <FaPlus className="h-3 w-3" />
            Terbitkan Link
          </button>
          <button
            type="button"
            onClick={ambilDaftar}
            disabled={memuat}
            className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaSyncAlt className={memuat ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() =>
              salin(link.filter((l) => l.link).map((l) => l.link).join('\n'), '__semua__')
            }
            disabled={!link.some((l) => l.link)}
            className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
          >
            {tersalin === '__semua__' ? (
              <FaCheck className="h-3 w-3 text-emerald-500" />
            ) : (
              <FaCopy className="h-3 w-3" />
            )}
            Salin semua link
          </button>
        </div>
      </section>

      {galat && (
        <p className="rounded-lg bg-rose-50 p-3 text-[12px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {galat}
        </p>
      )}
      {pesan && (
        <p className="rounded-lg bg-emerald-50 p-3 text-[12px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {pesan}
        </p>
      )}

      {/* ============ Tabel link terbit ============ */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaLink className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Link terbit ({link.length})
            </h3>
          </div>
          {memuat && (
            <span className="chip text-accent-600 dark:text-accent-300">
              <FaSyncAlt className="h-3 w-3 animate-spin" /> memuat
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead className="border-b border-paper-200 text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/[0.08]">
              <tr>
                <th className="px-4 py-2.5 font-bold">Modul / Field</th>
                <th className="px-3 py-2.5 font-bold">Akses</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Berlaku</th>
                <th className="px-3 py-2.5 font-bold">Link</th>
                <th className="px-3 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {link.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-paper-100 last:border-0 hover:bg-paper-50/60 dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-mono text-[10px] font-bold text-slate-400">
                      #{l.id} / {l.modul}
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                      {l.label || l.nama_modul}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {l.jumlah_kolom || 0} field / dibuat {l.dibuat_oleh || '-'}
                    </p>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        BADGE_VISIBILITAS[l.visibilitas] || BADGE_VISIBILITAS.publik
                      }`}
                    >
                      {l.visibilitas === 'private' ? (
                        <FaLock className="h-2.5 w-2.5" />
                      ) : (
                        <FaGlobe className="h-2.5 w-2.5" />
                      )}
                      {l.visibilitas}
                    </span>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        BADGE_STATUS[l.status] || BADGE_STATUS.aktif
                      }`}
                    >
                      {LABEL_STATUS[l.status] || l.status}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {l.jumlah_akses || 0}x diakses
                      {l.akses_terakhir ? ` / terakhir ${tanggal(l.akses_terakhir)}` : ''}
                    </p>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {l.masa_berlaku_hari} hari
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      s.d. {tanggal(l.kedaluwarsa_pada)}
                    </p>
                  </td>

                  <td className="max-w-[300px] px-3 py-3 align-top">
                    <code className="block break-all font-mono text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                      {l.link || '-'}
                    </code>
                  </td>

                  <td className="px-3 py-3 text-right align-top">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => salin(l.link, l.id)}
                        disabled={!l.link}
                        className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                        title="Salin link"
                      >
                        {tersalin === l.id ? (
                          <>
                            <FaCheck className="h-3 w-3 text-emerald-500" /> Tersalin
                          </>
                        ) : (
                          <>
                            <FaCopy className="h-3 w-3" /> Salin
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => ubahVisibilitas(l)}
                        disabled={sibuk}
                        className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                        title={
                          l.visibilitas === 'private'
                            ? 'Jadikan publik (tanpa token)'
                            : 'Jadikan private (wajib Bearer Keycloak)'
                        }
                      >
                        {l.visibilitas === 'private' ? (
                          <>
                            <FaGlobe className="h-3 w-3" /> Publik
                          </>
                        ) : (
                          <>
                            <FaLock className="h-3 w-3" /> Private
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => hapus(l)}
                        disabled={sibuk}
                        className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap text-rose-600 hover:text-rose-700 disabled:opacity-40 dark:text-rose-400"
                        title="Hapus link"
                      >
                        <FaTrash className="h-3 w-3" /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!memuat && !link.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Belum ada link terbit. Tekan <strong>Terbitkan Link</strong> untuk membuat yang
                    pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ Modal terbitkan ============ */}
      {bukaForm && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(ev) => ev.target === ev.currentTarget && setBukaForm(false)}
        >
          <form
            onSubmit={terbitkan}
            className="my-8 w-full max-w-3xl overflow-hidden rounded-xl border border-paper-300 bg-white shadow-xl dark:border-white/[0.08] dark:bg-ink-950"
          >
            <div className="flex items-start justify-between gap-4 border-b border-paper-200 p-4 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Link API baru
                </p>
                <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  Pilih field yang boleh keluar
                </h2>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                  Hanya field yang dicentang yang ikut ke knowledge LAURA AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBukaForm(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/5"
                aria-label="Tutup"
              >
                <FaTimes />
              </button>
            </div>

            <div className="max-h-[62vh] space-y-4 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Modul
                  </label>
                  <select
                    value={modul}
                    onChange={(ev) => setModul(ev.target.value)}
                    className="mt-1 w-full rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
                  >
                    {(data?.daftar_modul || []).map((m) => (
                      <option key={m.kode} value={m.kode}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Nama link (opsional)
                  </label>
                  <input
                    value={label}
                    onChange={(ev) => setLabel(ev.target.value)}
                    placeholder="mis. Sampel OT 2026 untuk LAURA"
                    className="mt-1 w-full rounded-lg border border-paper-300 px-2.5 py-1.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
                  />
                </div>
              </div>

              {katalogModul && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setKolomPilih(katalogModul.saran_kolom || [])}
                      className="btn-ghost text-[11px]"
                    >
                      Pilih ringkas ({katalogModul.saran_kolom?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setKolomPilih(
                          (katalogModul.grup || []).flatMap((g) =>
                            g.field.filter((f) => !f.pribadi).map((f) => f.kolom)
                          )
                        )
                      }
                      className="btn-ghost text-[11px]"
                    >
                      Pilih semua (kecuali data pribadi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKolomPilih([])}
                      className="btn-ghost text-[11px]"
                    >
                      Kosongkan
                    </button>
                    <span className="ml-auto text-[11px] font-semibold text-accent-600 dark:text-accent-400">
                      {kolomPilih.length} field dipilih
                    </span>
                  </div>

                  {(katalogModul.grup || []).map((g) => (
                    <div
                      key={g.nama}
                      className="rounded-xl border border-paper-200 p-3 dark:border-white/[0.08]"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {g.nama}
                      </p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {g.field.map((f) => (
                          <label
                            key={f.kolom}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12px] transition hover:bg-paper-50 dark:hover:bg-white/[0.03] ${
                              f.pribadi ? 'opacity-70' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={kolomPilih.includes(f.kolom)}
                              onChange={() => toggleKolom(f.kolom)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {f.label}
                              </span>
                              <span className="ml-1 font-mono text-[10px] text-slate-400">
                                {f.kolom}
                              </span>
                              {f.pribadi && (
                                <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                  pribadi
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Tahun data (opsional)
                  </label>
                  <input
                    value={tahun}
                    onChange={(ev) => setTahun(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2026"
                    className="mt-1 w-full rounded-lg border border-paper-300 px-2.5 py-1.5 font-mono text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Maks baris / tarikan
                  </label>
                  <input
                    value={limit}
                    onChange={(ev) => setLimit(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="500"
                    className="mt-1 w-full rounded-lg border border-paper-300 px-2.5 py-1.5 font-mono text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Masa berlaku (hari)
                  </label>
                  <input
                    value={masaBerlaku}
                    onChange={(ev) => setMasaBerlaku(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="30"
                    className="mt-1 w-full rounded-lg border border-paper-300 px-2.5 py-1.5 font-mono text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Visibilitas link
                </p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {PILIHAN_VISIBILITAS.map((v) => (
                    <label
                      key={v.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[12px] transition ${
                        visibilitas === v.id
                          ? 'border-accent-500 bg-accent-50/60 dark:border-accent-500/60 dark:bg-accent-500/10'
                          : 'border-paper-200 hover:bg-paper-50 dark:border-white/[0.08] dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibilitas"
                        checked={visibilitas === v.id}
                        onChange={() => setVisibilitas(v.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <v.Ikon className="h-3 w-3" /> {v.judul}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                          {v.ket}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-paper-200 p-4 dark:border-white/[0.08]">
              <button
                type="submit"
                disabled={sibuk || !kolomPilih.length}
                className="btn-primary-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                <FaSave className="h-3 w-3" />
                {sibuk ? 'Menerbitkan...' : 'Terbitkan & Salin'}
              </button>
              <button
                type="button"
                onClick={() => setBukaForm(false)}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <FaTimes className="h-3 w-3" />
                Batal
              </button>
              <span className="ml-auto text-[11px] text-slate-400">
                Link baru langsung disalin ke papan klip.
              </span>
            </div>
          </form>
        </div>
      )}

      {/* ============ Data publik /jendela-kinerja ============ */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaGlobe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Data publik /jendela-kinerja ({publikModul.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FaGlobe className="h-2.5 w-2.5" />
              selalu publik
            </span>
            <button
              type="button"
              onClick={ambilPublik}
              disabled={publikMemuat}
              className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FaSyncAlt className={publikMemuat ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
              Muat ulang
            </button>
          </div>
        </div>

        <div className="border-b border-paper-200 px-4 py-2.5 dark:border-white/[0.08]">
          <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            Daftar rute <code className="font-mono">/api/publik/kinerja/*</code> yang dipakai halaman
            depan <strong>/jendela-kinerja</strong>. Semuanya <strong>tetap publik</strong> — tidak
            terpengaruh pengaturan publik/private pada link di tabel atas.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={saringPublik}
              onChange={(ev2) => setSaringPublik(ev2.target.value)}
              placeholder="Cari modul / path / nama…"
              className="w-full max-w-xs rounded-lg border border-paper-300 px-2.5 py-1.5 text-[12px] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200"
            />
            <span className="text-[11px] text-slate-400">
              {publikTersaring.length} dari {publikModul.length} rute
            </span>
            {publik?.base_url && (
              <code className="ml-auto font-mono text-[10px] text-slate-400">{publik.base_url}</code>
            )}
          </div>
        </div>

        {publikGalat && (
          <p className="m-4 rounded-lg bg-rose-50 p-3 text-[12px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {publikGalat}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead className="border-b border-paper-200 text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/[0.08]">
              <tr>
                <th className="px-4 py-2.5 font-bold">Modul</th>
                <th className="px-3 py-2.5 font-bold">Halaman</th>
                <th className="px-3 py-2.5 font-bold">Data</th>
                <th className="px-3 py-2.5 font-bold">Endpoint publik</th>
                <th className="px-3 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {publikTersaring.map((m) => (
                <tr
                  key={m.kode}
                  className="border-b border-paper-100 last:border-0 hover:bg-paper-50/60 dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-mono text-[10px] font-bold text-slate-400">{m.kode}</p>
                    <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                      {m.nama}
                    </p>
                    <p className="mt-0.5 max-w-sm text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {m.keterangan}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <code className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {m.halaman || '-'}
                    </code>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <code className="rounded bg-paper-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {m.model_data}
                    </code>
                  </td>
                  <td className="max-w-[300px] px-3 py-3 align-top">
                    <code className="block break-all font-mono text-[10px] leading-snug text-emerald-700 dark:text-emerald-400">
                      {m.url_lengkap}
                    </code>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <button
                      type="button"
                      onClick={() => salin(m.url_lengkap, `publik-${m.kode}`)}
                      className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
                      title="Salin endpoint publik"
                    >
                      {tersalin === `publik-${m.kode}` ? (
                        <>
                          <FaCheck className="h-3 w-3 text-emerald-500" /> Tersalin
                        </>
                      ) : (
                        <>
                          <FaCopy className="h-3 w-3" /> Salin
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {!publikMemuat && !publikTersaring.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    {publikModul.length ? 'Tidak ada rute yang cocok dengan pencarian.' : 'Belum ada data publik.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ Penjelasan ============ */}
      <section className="panel p-5">
        <div className="flex items-start gap-2">
          <FaInfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
          <div className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-bold text-slate-800 dark:text-white">
              Publik, private, dan data halaman depan
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                <strong>Publik</strong> - link bisa ditarik tanpa token. Cocok untuk rekap yang tidak
                sensitif.
              </li>
              <li>
                <strong>Private</strong> - penarikan wajib menyertakan{' '}
                <code className="rounded bg-paper-100 px-1 font-mono text-[11px] dark:bg-white/5">
                  Authorization: Bearer
                </code>{' '}
                token Keycloak. Di LAURA AI, isi token itu di menu Integrasi JK.
              </li>
              <li>
                <strong>Data publik /jendela-kinerja tetap publik.</strong> Halaman itu memakai route{' '}
                <code className="rounded bg-paper-100 px-1 font-mono text-[11px] dark:bg-white/5">
                  /api/publik/kinerja/*
                </code>{' '}
                - terpisah dari fitur link, dan tidak berubah walau link di sini dibuat private.
              </li>
              <li>
                <strong>Token disegel di server</strong> (AES-256-GCM), jadi link bisa disalin ulang
                kapan saja tanpa menyimpan plaintext di database.
              </li>
              <li>
                <strong>Hapus</strong> membuat link langsung tidak berlaku. LAURA AI yang sudah
                menempelkan link itu akan gagal sinkron sampai link baru dibuat.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
