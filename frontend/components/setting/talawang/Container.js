// components/setting/talawang/Container.js
/**
 * SETTING → TALAWANG
 * ------------------
 * Mengatur akses API data realisasi Jendela Kinerja untuk aplikasi Talawang
 * (Sistem Perjalanan Dinas BBPOM Palangka Raya).
 *
 * YANG DIATUR DI SINI:
 *   1. Menerbitkan token akses (bisa dilihat/di salin ulang kapan saja).
 *   2. Mencabut token.
 *   3. Menyalin URL endpoint siap tempel ke konfigurasi Talawang.
 *   4. Melihat contoh jawaban API + batas cakupan datanya.
 *
 * BATAS CAKUPAN (penting, ditampilkan besar di halaman):
 *   Hanya akun 524xxx — Belanja Perjalanan Dinas. Talawang TIDAK menerima
 *   belanja pegawai (51), barang (52), maupun data pendapatan. Pembatasan ini
 *   ditegakkan di backend (lib/talawang-api.js), bukan sekadar pengaturan.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FaCheck,
  FaCopy,
  FaExclamationTriangle,
  FaKey,
  FaLock,
  FaPlus,
  FaRedo,
  FaRegClock,
  FaTrashAlt,
  FaLink,
} from 'react-icons/fa';
import {
  formatAngka,
  formatPersen,
  formatWaktu,
  gayaStatus,
  labelStatus,
  sisaHari,
} from './helper';

const BATAS_AKUN = '524';

export default function Container() {
  const [info, setInfo] = useState(null);
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [namaBaru, setNamaBaru] = useState('Talawang');
  const [hariBaru, setHariBaru] = useState(365);
  const [sedangTerbit, setSedangTerbit] = useState(false);
  const [tokenBaru, setTokenBaru] = useState(null);
  const [menyalin, setMenyalin] = useState('');
  const [konfirmasiCabut, setKonfirmasiCabut] = useState(null); // id yang akan dicabut
  const [sedangCabut, setSedangCabut] = useState(false);
  const [pratinjau, setPratinjau] = useState(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const [rInfo, rToken] = await Promise.all([
        fetch('/api/talawang/info', { cache: 'no-store' }),
        fetch('/api/talawang/token', { cache: 'no-store' }),
      ]);
      if (!rInfo.ok || !rToken.ok) throw new Error('Gagal memuat pengaturan Talawang.');
      const jInfo = await rInfo.json();
      const jToken = await rToken.json();
      setInfo(jInfo.data || null);
      setDaftar(jToken.data || []);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const salin = async (teks, tanda) => {
    try {
      await navigator.clipboard.writeText(teks);
      setMenyalin(tanda);
      setTimeout(() => setMenyalin(''), 1800);
    } catch {
      setGalat('Peramban menolak akses papan klip. Salin manual dari kotak teks.');
    }
  };

  const terbitkan = async (e) => {
    e.preventDefault();
    setSedangTerbit(true);
    setGalat('');
    try {
      const r = await fetch('/api/talawang/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nama: namaBaru, masa_berlaku_hari: Number(hariBaru) || 365 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Gagal menerbitkan token.');
      setTokenBaru(j.data);
      await muat();
    } catch (e2) {
      setGalat(e2.message);
    } finally {
      setSedangTerbit(false);
    }
  };

  const cabut = async (id) => {
    setSedangCabut(true);
    setGalat('');
    try {
      const r = await fetch(`/api/talawang/token/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Gagal mencabut token.');
      setKonfirmasiCabut(null);
      if (tokenBaru?.id === id) setTokenBaru(null);
      await muat();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSedangCabut(false);
    }
  };

  const ujiPratinjau = async (token) => {
    setMemuatPratinjau(true);
    setPratinjau(null);
    setGalat('');
    try {
      const r = await fetch(`/api/talawang/realisasi?token=${encodeURIComponent(token)}`);
      const j = await r.json();
      setPratinjau(j);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuatPratinjau(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ---------------- Batas cakupan ---------------- */}
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b3d78] dark:text-white">
              <FaLock className="text-[#006d30]" aria-hidden="true" />
              Akses API untuk Talawang
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Talawang (Sistem Perjalanan Dinas) dapat membaca angka realisasi anggaran dari
              Jendela Kinerja memakai token di bawah. Akses ini <strong>terkunci</strong> pada
              akun <span className="tnum font-semibold">{BATAS_AKUN}xxx</span> — Belanja
              Perjalanan Dinas.
            </p>
          </div>
          <span className="glass-chip shrink-0 text-xs font-semibold text-[#006d30] dark:text-emerald-300">
            {BATAS_AKUN}xxx saja
          </span>
        </div>

        {info?.nama_akun ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(info.nama_akun).map(([kode, nama]) => (
              <div
                key={kode}
                className="flex items-start gap-2.5 rounded-xl border border-[#eef4fa] px-3 py-2.5 dark:border-white/10"
              >
                <span className="tnum mt-0.5 shrink-0 rounded-md bg-[#005bac] px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {kode}
                </span>
                <span className="text-xs leading-[1.6] text-slate-600 dark:text-slate-300">{nama}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-[1.7] text-slate-500 dark:bg-white/5 dark:text-slate-400">
          Belanja pegawai (51), belanja barang (52), dan data pendapatan <strong>tidak</strong> ikut
          terkirim. Pembatasan ditegakkan di server, jadi tidak bisa diperlebar lewat parameter URL.
        </p>
      </section>

      {/* ---------------- Terbitkan token ---------------- */}
      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b3d78] dark:text-white">
          <FaKey className="text-[#005bac]" aria-hidden="true" />
          Terbitkan token baru
        </h2>

        <form onSubmit={terbitkan} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nama / keterangan
            </span>
            <input
              type="text"
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              maxLength={120}
              className="w-full rounded-xl border border-[#dbe7f3] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#005bac] dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Berlaku (hari)
            </span>
            <input
              type="number"
              min={1}
              max={3650}
              value={hariBaru}
              onChange={(e) => setHariBaru(e.target.value)}
              className="tnum w-full rounded-xl border border-[#dbe7f3] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#005bac] dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <button type="submit" disabled={sedangTerbit} className="btn-primary-sm h-[38px] px-4 disabled:opacity-60">
            <FaPlus aria-hidden="true" />
            {sedangTerbit ? 'Menerbitkan…' : 'Terbitkan'}
          </button>
        </form>

        {tokenBaru ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Token diterbitkan — salin sekarang, atau salin lagi kapan saja dari tabel di bawah.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="tnum min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-700 dark:bg-black/30 dark:text-slate-200">
                {tokenBaru.token}
              </code>
              <button
                type="button"
                onClick={() => salin(tokenBaru.token, 'token-baru')}
                className="btn-primary-sm px-3"
              >
                {menyalin === 'token-baru' ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
                {menyalin === 'token-baru' ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p className="mt-2 break-all text-[11px] leading-[1.6] text-emerald-700/80 dark:text-emerald-400/80">
              {tokenBaru.url_contoh}
            </p>
          </div>
        ) : null}
      </section>

      {/* ---------------- Daftar token ---------------- */}
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b3d78] dark:text-white">
            <FaRegClock className="text-[#005bac]" aria-hidden="true" />
            Token yang pernah diterbitkan
          </h2>
          <button type="button" onClick={muat} disabled={memuat} className="btn-primary-sm px-3 disabled:opacity-60">
            <FaRedo aria-hidden="true" />
            {memuat ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>

        {galat ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
            {galat}
          </p>
        ) : null}

        {!memuat && !daftar.length ? (
          <p className="mt-4 rounded-xl border border-dashed border-[#dbe7f3] px-3 py-6 text-center text-xs leading-relaxed text-slate-500 dark:border-white/15 dark:text-slate-400">
            Belum ada token. Terbitkan satu di atas, lalu tempel URL-nya pada konfigurasi Talawang.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {daftar.map((t) => {
            const sisa = sisaHari(t.kedaluwarsa_pada);
            return (
              <div
                key={t.id}
                className="rounded-xl border border-[#eef4fa] p-3.5 dark:border-white/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {t.nama}
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${gayaStatus(t.status)}`}>
                        {labelStatus(t.status)}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] leading-[1.6] text-slate-500 dark:text-slate-400">
                      Akun {t.akun_awalan}xxx · berlaku {t.masa_berlaku_hari} hari · diterbitkan{' '}
                      {formatWaktu(t.terbit_pada)}
                      {sisa !== null ? ` · ${sisa > 0 ? `sisa ${sisa} hari` : 'sudah berakhir'}` : ''}
                      {t.dibuat_oleh ? ` · oleh ${t.dibuat_oleh}` : ''}
                    </p>
                    <p className="mt-1 text-[11px] leading-[1.6] text-slate-400 dark:text-slate-500">
                      Dipakai {formatAngka(t.jumlah_akses)} kali
                      {t.akses_terakhir ? ` · terakhir ${formatWaktu(t.akses_terakhir)}` : ' · belum pernah dipakai'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {t.token && t.status === 'aktif' ? (
                      <>
                        <button type="button" onClick={() => salin(t.token, `t-${t.id}`)} className="btn-primary-sm px-2.5">
                          {menyalin === `t-${t.id}` ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
                          {menyalin === `t-${t.id}` ? 'Tersalin' : 'Salin'}
                        </button>
                        <button
                          type="button"
                          onClick={() => ujiPratinjau(t.token)}
                          disabled={memuatPratinjau}
                          className="btn-primary-sm px-2.5 disabled:opacity-60"
                        >
                          <FaLink aria-hidden="true" />
                          Uji
                        </button>
                      </>
                    ) : null}

                    {t.status === 'aktif' || t.status === 'segera_kedaluwarsa' ? (
                      konfirmasiCabut === t.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => cabut(t.id)}
                            disabled={sedangCabut}
                            className="btn-danger-sm px-2.5 disabled:opacity-60"
                          >
                            <FaTrashAlt aria-hidden="true" />
                            {sedangCabut ? 'Mencabut…' : 'Ya, cabut'}
                          </button>
                          <button type="button" onClick={() => setKonfirmasiCabut(null)} className="btn-primary-sm px-2.5">
                            Batal
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setKonfirmasiCabut(t.id)} className="btn-danger-sm px-2.5">
                          <FaTrashAlt aria-hidden="true" />
                          Cabut
                        </button>
                      )
                    ) : null}
                  </div>
                </div>

                {t.token ? (
                  <code className="tnum mt-2.5 block break-all rounded-lg bg-slate-50 px-2.5 py-2 text-[10.5px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    {t.token}
                  </code>
                ) : (
                  <p className="mt-2.5 text-[10.5px] leading-[1.6] text-slate-400 dark:text-slate-500">
                    Token tidak dapat ditampilkan (sudah dicabut atau disegel dengan rahasia lama).
                    Terbitkan token baru bila masih dibutuhkan.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Endpoint & contoh ---------------- */}
      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b3d78] dark:text-white">
          <FaLink className="text-[#005bac]" aria-hidden="true" />
          Endpoint untuk konfigurasi Talawang
        </h2>

        {info?.endpoint ? (
          <div className="mt-4 space-y-3">
            {[
              { label: 'Realisasi belanja perjalanan dinas', nilai: info.endpoint.realisasi },
              { label: 'Daftar tahun tersedia', nilai: info.endpoint.tahun },
            ].map((e) => (
              <div key={e.label}>
                <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{e.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    {e.nilai}
                  </code>
                  <button type="button" onClick={() => salin(e.nilai, e.label)} className="btn-primary-sm px-2.5">
                    {menyalin === e.label ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
                    {menyalin === e.label ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-[11px] leading-[1.7] text-slate-500 dark:text-slate-400">
          Token boleh dikirim sebagai <code className="tnum">?token=</code> pada URL atau sebagai
          header <code className="tnum">Authorization: Bearer &lt;token&gt;</code>. Jawaban sudah memuat
          rincian per MAK (pagu, realisasi, persen, sisa). Filter opsional:
          <code className="tnum">&amp;komponen=BDB</code>, <code className="tnum">&amp;akun=524111</code>,
          <code className="tnum">&amp;limit=50</code>.
        </p>

        {pratinjau ? (
          <div className="mt-4 rounded-xl border border-[#eef4fa] p-3.5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Pratinjau jawaban {pratinjau.success && pratinjau.data?.tahun ? `— tahun ${pratinjau.data.tahun}` : ''}
              </p>
              <button type="button" onClick={() => setPratinjau(null)} className="btn-primary-sm px-2.5">
                Tutup
              </button>
            </div>

            {pratinjau.success && pratinjau.data ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Pagu', nilai: formatAngka(pratinjau.data.total.pagu), warna: 'text-[#005bac] dark:text-sky-300' },
                    { label: 'Realisasi', nilai: formatAngka(pratinjau.data.total.realisasi), warna: 'text-[#006d30] dark:text-emerald-300' },
                    { label: 'Serapan', nilai: formatPersen(pratinjau.data.total.persen ?? pratinjau.data.total.persen_serapan), warna: 'text-slate-700 dark:text-slate-200' },
                    { label: 'Sisa', nilai: formatAngka(pratinjau.data.total.sisa), warna: 'text-slate-700 dark:text-slate-200' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
                      <p className="text-[10.5px] leading-[1.6] text-slate-500 dark:text-slate-400">{k.label}</p>
                      <p className={`tnum mt-1 text-sm font-bold leading-[1.5] ${k.warna}`}>{k.nilai}</p>
                    </div>
                  ))}
                </div>

                {/* Rincian per MAK — bentuk inilah yang dipakai Talawang:
                    mak | pagu | realisasi | persen | sisa. */}
                <div className="mt-3.5 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="pb-1.5 pr-2 font-semibold">MAK</th>
                        <th className="pb-1.5 pr-2 text-right font-semibold">Pagu</th>
                        <th className="pb-1.5 pr-2 text-right font-semibold">Realisasi</th>
                        <th className="pb-1.5 pr-2 text-right font-semibold">%</th>
                        <th className="pb-1.5 text-right font-semibold">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pratinjau.data.rincian_mak || []).slice(0, 6).map((m) => (
                        <tr key={m.mak} className="border-t border-[#eef4fa] align-top dark:border-white/10">
                          <td className="tnum py-2 pr-2 text-[10.5px] leading-[1.6] text-slate-700 dark:text-slate-200">
                            {m.mak}
                          </td>
                          <td className="tnum py-2 pr-2 text-right text-[11px] leading-[1.6] text-[#005bac] dark:text-sky-300">
                            {formatAngka(m.pagu)}
                          </td>
                          <td className="tnum py-2 pr-2 text-right text-[11px] leading-[1.6] text-[#006d30] dark:text-emerald-300">
                            {formatAngka(m.realisasi)}
                          </td>
                          <td className="tnum py-2 pr-2 text-right text-[11px] leading-[1.6] text-slate-700 dark:text-slate-200">
                            {formatPersen(m.persen)}
                          </td>
                          <td className="tnum py-2 text-right text-[11px] leading-[1.6] text-slate-700 dark:text-slate-200">
                            {formatAngka(m.sisa)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pratinjau.data.rincian_mak?.length > 6 ? (
                    <p className="mt-2 text-[10.5px] leading-[1.6] text-slate-500 dark:text-slate-400">
                      Menampilkan 6 dari {pratinjau.data.rincian_mak.length} MAK
                      {pratinjau.data.terpotong ? ' (jawaban dipotong oleh limit)' : ''}.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                {pratinjau.message || 'Gagal mengambil pratinjau.'}
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
