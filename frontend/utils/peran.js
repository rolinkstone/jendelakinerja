// utils/peran.js
/**
 * SATU SUMBER KEBENARAN PERAN (sisi klien).
 * ==========================================
 * Aturan akses aplikasi Jendela Kinerja:
 *
 *   admin, admin_jendela_kinerja  -> AKSES PENUH: baca + tulis (impor berkas,
 *                                    hapus data) + menu Setting.
 *   selain itu (mis. `user`)      -> HANYA BACA: semua modul bisa DIBUKA dan
 *                                    dibaca, tetapi tombol unggah/impor/hapus
 *                                    tidak ditampilkan dan menu Setting tidak
 *                                    muncul di sidebar.
 *
 * PENTING: ini hanya lapisan tampilan. Penjagaan sesungguhnya ada di backend
 * (backend/lib/verifikasi-token.js -> PERAN_TULIS, dan
 * backend/middleware/keycloakAuth.js -> hanyaAdmin). Menyembunyikan tombol
 * TIDAK boleh menjadi satu-satunya pertahanan.
 */
import { useSession } from 'next-auth/react';

/** Peran yang punya akses penuh — harus sama dengan PERAN_ADMIN di backend. */
export const PERAN_ADMIN = ['admin', 'admin_jendela_kinerja'];

/** Label peran untuk ditampilkan di antarmuka. */
export const LABEL_PERAN = {
  admin: 'Administrator',
  admin_jendela_kinerja: 'Administrator Jendela Kinerja',
  user: 'Pengguna',
};

/** Apakah daftar peran memuat salah satu peran administrator penuh. */
export const punyaAksesPenuh = (roles) =>
  Array.isArray(roles) && roles.some((r) => PERAN_ADMIN.includes(String(r).toLowerCase()));

/**
 * Hook: apakah pengguna saat ini punya akses penuh.
 * Aman dipakai walau sesi belum termuat — selama status masih `loading`
 * hasilnya `false`, jadi tombol tulis tidak sempat berkedip muncul.
 */
export function useAksesPenuh() {
  const { data: session, status } = useSession();
  if (status !== 'authenticated') return false;
  return punyaAksesPenuh(session?.user?.roles);
}

/** Hook: peran pengguna saat ini sebagai array (selalu array, tidak null). */
export function usePeranSaya() {
  const { data: session } = useSession();
  const roles = session?.user?.roles;
  return Array.isArray(roles) ? roles : [];
}
