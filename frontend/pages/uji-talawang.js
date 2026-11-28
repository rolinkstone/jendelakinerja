import Container from '../components/setting/talawang/Container';

// HARNESS SEMENTARA — hanya untuk memeriksa render komponen tanpa sesi SSO.
// Dihapus setelah verifikasi.
export default function UjiTalawang() {
  return (
    <div className="app-gradient min-h-screen p-4">
      <Container />
    </div>
  );
}
