// lib/tts.js
/**
 * SUARA LAURA \u2014 satu sumber pengaturan TTS untuk SEMUA tempat
 * -----------------------------------------------------------
 * Dipakai oleh:
 *  - widget publik `components/jendela-kinerja/LauraAI.js`
 *  - halaman dashboard `components/beranda/NarasiPresentasiContainer.js`
 *
 * Kenapa modul terpisah: sebelumnya tiap komponen membuat SpeechSynthesisUtterance
 * sendiri dengan `lang='id-ID'` dan laju 0.98 yang dipaku di kode. Akibatnya
 * suara TIDAK BISA diganti tanpa mengedit kode, dan di Windows yang hanya punya
 * paket suara en-US, Laura membaca bahasa Indonesia dengan lidah Inggris.
 *
 * Sekarang: daftar suara sistem dibaca, operator memilih, pilihannya disimpan di
 * localStorage, dan semua pemutaran lewat `bacakan()` di sini.
 *
 * Tiga hal yang bisa diubah:
 *   1. `nama`  \u2014 suara mana (dari daftar suara sistem/browser)
 *   2. `laju`  \u2014 kecepatan bicara (0.5 \u2013 1.5; 1 = normal)
 *   3. `nada`  \u2014 tinggi rendah suara (0.5 \u2013 1.5)
 *
 * Suara TIDAK disintesis di server. Yang tersedia = yang terpasang di perangkat
 * pengunjung. Jadi operator bisa memilih, tapi kalau perangkat pengunjung tidak
 * punya suara itu, browser memakai suara terdekat (lihat `pilihUtteranceVoice`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Kunci penyimpanan preferensi suara. */
const KUNCI = 'laura-suara-v1';

/** Preferensi awal \u2014 Indonesia, tempo sedikit lambat agar jelas. */
export const PREFERENSI_AWAL = { nama: '', laju: 0.98, nada: 1, lang: 'id-ID' };

/** Batas aman slider. */
export const BATAS = {
  laju: { min: 0.5, max: 1.5, step: 0.02 },
  nada: { min: 0.5, max: 1.5, step: 0.05 },
};

const adaSuara = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const bacaSimpanan = () => {
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return null;
    const isi = JSON.parse(mentah);
    return { ...PREFERENSI_AWAL, ...isi };
  } catch (e) {
    return null;
  }
};

/**
 * Pilih voice untuk satu utterance.
 * Urutan: nama tersimpan \u2192 bahasa target (id) \u2192 suara Indonesia apa pun \u2192
 * null (biarkan browser memilih). Mengembalikan null berarti utterance memakai
 * suara default sistem.
 */
/**
 * Nama voice yang dikenal WANITA / PRIA.
 *
 * Kenapa perlu daftar eksplisit: Web Speech API tidak menyediakan field gender.
 * Tanpa daftar ini, pemilihan jatuh ke voice pertama yang bahasanya cocok \u2014
 * dan di Windows default-nya `Microsoft David` (PRIYA). Itu sebabnya di satu
 * laptop LAURA bersuara wanita (ada `Microsoft Gadis - id-ID`), di perangkat
 * lain bersuara pria (tidak ada voice Indonesia \u2192 default sistem = David).
 *
 * `Zira`/`Sari`/`Damayanti` dst. adalah nama voice wanita bawaan Windows/Chrome.
 */
const NAMA_WANITA = /gadis|female|wanita|perempuan|zira|sari|damayanti|andini|dewi|lestari|indah|maya|siti|nova|aria|jenny|sonia|michelle|google\s*bahasa\s*indonesia/i;

/** Voice pria \u2014 dipakai sebagai penalti terakhir, bukan larangan mutlak. */
const NAMA_PRIA = /\bardi\b|\bandika\b|\bmale\b|\bpria\b|david|mark|budi|rizwan|arif|dimas/i;

const wanita = (v) => NAMA_WANITA.test(v.name);
const pria = (v) => NAMA_PRIA.test(v.name);

/**
 * Pilih voice untuk satu utterance.
 *
 * Urutan (penting \u2014 jangan diacak):
 *   1. nama tersimpan (pilihan operator) \u2014 dihormati apa adanya;
 *   2. id-ID WANITA   \u2192 Gadis, Google Bahasa Indonesia, dst.
 *   3. bahasa target apa pun (id) \u2014 lebih baik daripada suara Inggris;
 *   4. WANITA dengan bahasa apa pun \u2014 menjaga karakter suara tetap perempuan
 *      walau perangkat tidak punya voice Indonesia (mis. Zira en-US);
 *   5. bahasa target/primer apa pun;
 *   6. null \u2192 biarkan browser memilih (BISA PRIA; hanya terjadi bila tidak ada
 *      satu pun voice yang dikenali).
 *
 * Poin 4 adalah perbaikan inti: sebelumnya perangkat tanpa voice Indonesia
 * langsung jatuh ke `null`, sehingga Windows memakai David (pria).
 */
function pilihVoice(daftar, pref) {
  if (!daftar || daftar.length === 0) return null;

  if (pref.nama) {
    const tepat = daftar.find((v) => v.name === pref.nama);
    if (tepat) return tepat;
    // Suara tersimpan tidak ada di perangkat ini (mis. operator memilih suara
    // di laptopnya, pengunjung membuka dari HP) \u2192 jatuh ke pencocokan bahasa.
  }

  const target = (pref.lang || 'id-ID').toLowerCase();
  const kode = target.slice(0, 2);
  const bahasa = (v, pola) => String(v.lang || '').toLowerCase().startsWith(pola);

  return (
    // 2. Indonesia + wanita
    daftar.find((v) => v.lang.toLowerCase() === target && wanita(v)) ||
    // 3. Indonesia apa pun
    daftar.find((v) => v.lang.toLowerCase() === target) ||
    daftar.find((v) => bahasa(v, kode)) ||
    // 4. Wanita bahasa apa pun (mis. Zira en-US) \u2014 jaga karakter suara
    daftar.find((v) => wanita(v) && !pria(v)) ||
    // 5. Sisanya, hindari yang jelas pria bila masih ada pilihan lain
    daftar.find((v) => !pria(v)) ||
    null
  );
}

/**
 * Hook pengaturan suara.
 * @returns {{
 *   tersedia: boolean, daftar: Array, pref: object, set: Function,
 *   bacakan: Function, berhenti: Function, sedangBicara: boolean, reset: Function
 * }}
 */
export function useSuaraLaura() {
  const [tersedia, setTersedia] = useState(false);
  const [daftar, setDaftar] = useState([]);
  const [pref, setPref] = useState(PREFERENSI_AWAL);
  const [sedangBicara, setSedangBicara] = useState(false);
  const prefRef = useRef(PREFERENSI_AWAL);
  const daftarRef = useRef([]);

  // Muat preferensi tersimpan sekali.
  useEffect(() => {
    const simpanan = bacaSimpanan();
    if (simpanan) {
      setPref(simpanan);
      prefRef.current = simpanan;
    }
  }, []);

  // Baca daftar suara. Chrome mengisinya ASINKRON: daftar pertama biasanya
  // kosong, lalu `voiceschanged` menyala. Tanpa menunggu event ini, pilihan
  // suara tampil kosong padahal suara ada.
  useEffect(() => {
    if (!adaSuara()) return undefined;
    setTersedia(true);

    const muat = () => {
      const v = window.speechSynthesis.getVoices() || [];
      if (v.length === 0) return;
      const urut = [...v].sort((a, b) => {
        const ai = /^id/i.test(a.lang) ? 0 : 1;
        const bi = /^id/i.test(b.lang) ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
      });
      daftarRef.current = urut;
      setDaftar(urut);
    };

    muat();
    window.speechSynthesis.addEventListener('voiceschanged', muat);
    // Jaring pengaman: sebagian browser tidak pernah menembak voiceschanged.
    const t = setTimeout(muat, 1200);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', muat);
      clearTimeout(t);
    };
  }, []);

  // Hentikan suara saat halaman ditinggalkan \u2014 jangan biarkan TTS menggantung.
  useEffect(() => () => {
    if (adaSuara()) window.speechSynthesis.cancel();
  }, []);

  const set = useCallback((perubahan) => {
    setPref((lama) => {
      const baru = { ...lama, ...perubahan };
      prefRef.current = baru;
      try { window.localStorage.setItem(KUNCI, JSON.stringify(baru)); } catch (e) { /* abaikan */ }
      return baru;
    });
  }, []);

  const reset = useCallback(() => {
    prefRef.current = PREFERENSI_AWAL;
    setPref(PREFERENSI_AWAL);
    try { window.localStorage.removeItem(KUNCI); } catch (e) { /* abaikan */ }
  }, []);

  const berhenti = useCallback(() => {
    if (adaSuara()) window.speechSynthesis.cancel();
    setSedangBicara(false);
  }, []);

  /**
   * Bacakan teks dengan preferensi aktif.
   * @param {string} teks
   * @param {{selesai?: Function, abaikanBilaKosong?: boolean}} opsi
   */
  const bacakan = useCallback((teks, opsi = {}) => {
    const { selesai = null } = opsi;
    const isi = String(teks || '').trim();
    if (!adaSuara() || !isi) {
      if (selesai) selesai();
      return;
    }
    window.speechSynthesis.cancel();
    const p = prefRef.current;
    const u = new SpeechSynthesisUtterance(isi);
    const v = pilihVoice(daftarRef.current, p);
    if (v) u.voice = v;
    u.lang = v?.lang || p.lang || 'id-ID';
    u.rate = Number(p.laju) || 1;
    u.pitch = Number(p.nada) || 1;
    u.onstart = () => setSedangBicara(true);
    u.onend = () => { setSedangBicara(false); if (selesai) selesai(); };
    u.onerror = () => { setSedangBicara(false); if (selesai) selesai(); };
    window.speechSynthesis.speak(u);
  }, []);

  /** Coba satu suara tanpa mengubah preferensi (tombol "Dengarkan contoh"). */
  const coba = useCallback((nama, contohTeks) => {
    if (!adaSuara()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(contohTeks || 'Selamat datang di Jendela Kinerja. Saya Laura, asisten data Anda.');
    const v = daftarRef.current.find((x) => x.name === nama);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    const p = prefRef.current;
    u.rate = Number(p.laju) || 1;
    u.pitch = Number(p.nada) || 1;
    u.onstart = () => setSedangBicara(true);
    u.onend = () => setSedangBicara(false);
    u.onerror = () => setSedangBicara(false);
    window.speechSynthesis.speak(u);
  }, []);

  return { tersedia, daftar, pref, set, reset, bacakan, berhenti, sedangBicara, coba };
}

/** Label ringkas untuk satu voice: "Microsoft Gadis \u2014 id-ID". */
export const labelVoice = (v) => `${v.name} \u2014 ${v.lang}${v.localService ? '' : ' (online)'}`;
