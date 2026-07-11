import mysql from 'mysql2/promise';
import awsCaBundle from 'aws-ssl-profiles';
import ExcelJS from 'exceljs';

let pool;
const getPool = () => pool ||= mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? undefined : { ...awsCaBundle, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  waitForConnections: true, connectionLimit: 2, queueLimit: 0, enableKeepAlive: true
});
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const auditStatus = row => ['revision_software', 'antivirus', 'usb', 'paginas_no_autorizadas', 'escritorio', 'tiempo_bloqueo', 'bloqueo_configuracion', 'glpi'].every(field => Number(row[field])) ? 'REVISADO' : 'PENDIENTE';
const styleSheet = sheet => {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}1` };
  sheet.getRow(1).height = 28; sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769D2' } }; cell.alignment = { vertical: 'middle' }; });
  sheet.columns.forEach(column => { let width = String(column.header || '').length; column.eachCell({ includeEmpty: true }, cell => { width = Math.max(width, String(cell.value || '').length); }); column.width = Math.min(Math.max(width + 2, 13), 45); });
  sheet.eachRow((row, number) => { if (number > 1 && number % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }; }); row.alignment = { vertical: 'top', wrapText: true }; });
};

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });
  try {
    const db = getPool();
    const [equipos] = await db.execute(`SELECT e.serial_number, e.area, e.responsable, e.ip_address,
      a.revision_software, a.antivirus, a.usb, a.paginas_no_autorizadas, a.escritorio, a.tiempo_bloqueo, a.bloqueo_configuracion, a.glpi,
      i.modelo, i.mtm, i.familia, i.estado_garantia, e.created_at
      FROM equipos e LEFT JOIN auditoria_2026 a ON a.equipo_id=e.id LEFT JOIN informacion_lenovo i ON i.equipo_id=e.id ORDER BY e.area, e.serial_number`);
    const [laptops] = await db.execute(`SELECT l.serial_number, l.area, l.responsable, i.modelo, i.mtm, i.familia,
      i.estado_garantia, l.created_at FROM laptops l
      LEFT JOIN informacion_lenovo_laptops i ON i.laptop_id=l.id ORDER BY l.area, l.serial_number`);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'Sistema HAQ'; workbook.created = new Date();
    const eq = workbook.addWorksheet('Equipos');
    eq.columns = [
      { header: 'Número de serie', key: 'serial_number' }, { header: 'Área', key: 'area' }, { header: 'Responsable', key: 'responsable' }, { header: 'Dirección IP', key: 'ip_address' },
      { header: 'Auditoría 2026', key: 'auditoria' },
      { header: 'Modelo Lenovo', key: 'modelo' }, { header: 'MTM', key: 'mtm' }, { header: 'Familia', key: 'familia' }, { header: 'Garantía', key: 'estado_garantia' }, { header: 'Fecha de registro', key: 'created_at' }
    ];
    equipos.forEach(row => eq.addRow({ ...row, auditoria: auditStatus(row) })); styleSheet(eq);
    const lap = workbook.addWorksheet('Laptops');
    lap.columns = [{ header: 'Número de serie', key: 'serial_number' }, { header: 'Área', key: 'area' }, { header: 'Responsable', key: 'responsable' }, { header: 'Modelo Lenovo', key: 'modelo' }, { header: 'MTM', key: 'mtm' }, { header: 'Familia', key: 'familia' }, { header: 'Garantía', key: 'estado_garantia' }, { header: 'Fecha de registro', key: 'created_at' }];
    laptops.forEach(row => lap.addRow(row)); styleSheet(lap);
    const buffer = await workbook.xlsx.writeBuffer();
    return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="inventario-haq-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Cache-Control': 'no-store' }, body: Buffer.from(buffer).toString('base64') };
  } catch (error) { console.error('Error exportando inventario', { code: error.code, message: error.message }); return json(500, { error: 'No fue posible generar el archivo Excel.', code: error.code }); }
}
