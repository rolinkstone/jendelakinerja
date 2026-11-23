// lib/tts.js
/**
 * SUARA LAURA — satu sumber pengaturan TTS untuk SEMUA tempat
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
 *   1. `nama`  — suara mana (dari daftar suara sistem/browser)
 *   2. `laju`  — kecepatan bicara (0.5 – 1.5; 1 = normal)
 *   3. `nada`  — tinggi rendah suara (0.5 – 1.5)
 *
 * Suara TIDAK disintesis di server. Yang tersedia = yang terpasang di perangkat
 * pengunjung. Jadi operator bisa memilih, tapi kalau perangkat pengunjung tidak
 * punya suara itu, browser memakai suara terdekat (lihat `pilihUtteranceVoice`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Kunci penyimpanan preferensi suara. */
const KUNCI = 'laura-suara-v1';

/** Preferensi awal — Indonesia, tempo sedikit lambat agar jelas. */
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
 * Urutan: nama tersimpan → bahasa target (id) → suara Indonesia apa pun →
 * null (biarkan browser memilih). Mengembalikan null berarti utterance memakai
 * suara default sistem.
 */
function pilihVoice(daftar, pref) {
  if (!daftar || daftar.length === 0) return null;

  if (pref.nama) {
    const tepat = daftar.find((v) => v.name === pref.nama);
    if (tepat) return tepat;
    // Suara tersimpan tidak ada di perangkat ini (mis. operator memilih suara
    // di laptopnya, pengunjung membuka dari HP) → jatuh ke pencocokan bahasa.
  }

  const target = (pref.lang || 'id-ID').toLowerCase();
  const kode = target.slice(0, 2);
  return (
    daftar.find((v) => v.lang.toLowerCase() === target) ||
    daftar.find((v) => v.lang.toLowerCase().startsWith(kode)) ||
    // Terakhir: suara apa pun yang mungkin bisa melafalkan Indonesia lebih baik
    // daripada default (mis. Microsoft Gadis/Gadis Online bila terpasang).
    daftar.find((v) => /indones|gadis|andika|ardi/i.test(v.name)) ||
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

  // Hentikan suara saat halaman ditinggalkan — jangan biarkan TTS menggantung.
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

/** Label ringkas untuk satu voice: "Microsoft Gadis — id-ID". */
export const labelVoice = (v) => `${v.name} — ${v.lang}${v.localService ? '' : ' (online)'}`;
