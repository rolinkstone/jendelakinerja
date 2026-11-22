// scripts/inspect-xlsx.js — inspeksi struktur file Excel (dipakai saat pengembangan)
const XLSX = require('xlsx');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-xlsx.js <file.xlsx>');
  process.exit(1);
}
const wb = XLSX.readFile(file);
console.log('SHEETS:', JSON.stringify(wb.SheetNames));
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  console.log('=== SHEET:', name, '| ref:', ws['!ref'], '| baris:', rows.length);
  rows.slice(0, 10).forEach((r, i) => console.log(String(i).padStart(2), JSON.stringify(r)));
  if (rows.length > 10) {
    console.log('  ...');
    rows.slice(-3).forEach((r, i) => console.log('end', i, JSON.stringify(r)));
  }
}
