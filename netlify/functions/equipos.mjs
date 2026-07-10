import mysql from 'mysql2/promise';
import awsCaBundle from 'aws-ssl-profiles';

let pool;
const getPool = () => pool ||= mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? undefined : { ...awsCaBundle, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  enableKeepAlive: true
});
const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const ipValid = ip => { const p = ip.split('.'); return p.length === 4 && p.every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255); };
const validate = b => !b?.serialNumber?.trim() ? 'El número de serie es obligatorio.' : !b?.area?.trim() ? 'El área es obligatoria.' : !ipValid(b?.ipAddress?.trim() || '') ? 'La dirección IP no es válida.' : null;

export async function handler(event) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length || process.env.DB_PASSWORD?.startsWith('REEMPLAZA_')) {
    const fields = process.env.DB_PASSWORD?.startsWith('REEMPLAZA_') ? [...missing, 'DB_PASSWORD_REAL'] : missing;
    console.error('Configuración MySQL incompleta', { missing: fields });
    return reply(500, { error: 'Falta configurar la conexión MySQL.', code: 'DB_CONFIG_MISSING', missing: fields });
  }
  const method = event.httpMethod, id = event.path.split('/').filter(Boolean).at(-1), hasId = /^\d+$/.test(id);
  try {
    const db = getPool();
    if (method === 'GET' && !hasId) { const [rows] = await db.execute(`SELECT e.id, e.serial_number AS serialNumber, e.area, e.ip_address AS ipAddress, e.created_at AS createdAt,
      COALESCE(a.revision_software, 0) AS revisionSoftware, COALESCE(a.antivirus, 0) AS antivirus,
      COALESCE(a.usb, 0) AS usb, COALESCE(a.paginas_no_autorizadas, 0) AS paginasNoAutorizadas,
      COALESCE(a.escritorio, 0) AS escritorio, COALESCE(a.tiempo_bloqueo, 0) AS tiempoBloqueo,
      COALESCE(a.glpi_antivirus, 0) AS glpiAntivirus
      FROM equipos e LEFT JOIN auditoria_2026 a ON a.equipo_id=e.id ORDER BY e.created_at DESC`); return reply(200, rows); }
    if (method === 'POST') {
      const b = JSON.parse(event.body || '{}'), error = validate(b); if (error) return reply(400, { error });
      const connection = await db.getConnection();
      try { await connection.beginTransaction(); const [r] = await connection.execute('INSERT INTO equipos (serial_number, area, ip_address) VALUES (?, ?, ?)', [b.serialNumber.trim(), b.area.trim(), b.ipAddress.trim()]); const a = b.auditoria || {}; await connection.execute('INSERT INTO auditoria_2026 (equipo_id, revision_software, antivirus, usb, paginas_no_autorizadas, escritorio, tiempo_bloqueo, glpi_antivirus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [r.insertId, !!a.revisionSoftware, !!a.antivirus, !!a.usb, !!a.paginasNoAutorizadas, !!a.escritorio, !!a.tiempoBloqueo, !!a.glpiAntivirus]); await connection.commit(); return reply(201, { id: r.insertId, message: 'Equipo registrado.' }); } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
    }
    if (method === 'PUT' && hasId) {
      const b = JSON.parse(event.body || '{}'), error = validate(b); if (error) return reply(400, { error });
      const connection = await db.getConnection();
      try { await connection.beginTransaction(); const [r] = await connection.execute('UPDATE equipos SET serial_number=?, area=?, ip_address=? WHERE id=?', [b.serialNumber.trim(), b.area.trim(), b.ipAddress.trim(), Number(id)]); if (!r.affectedRows) { await connection.rollback(); return reply(404, { error: 'Equipo no encontrado.' }); } const a = b.auditoria || {}; await connection.execute(`INSERT INTO auditoria_2026 (equipo_id, revision_software, antivirus, usb, paginas_no_autorizadas, escritorio, tiempo_bloqueo, glpi_antivirus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE revision_software=VALUES(revision_software), antivirus=VALUES(antivirus), usb=VALUES(usb), paginas_no_autorizadas=VALUES(paginas_no_autorizadas), escritorio=VALUES(escritorio), tiempo_bloqueo=VALUES(tiempo_bloqueo), glpi_antivirus=VALUES(glpi_antivirus)`, [Number(id), !!a.revisionSoftware, !!a.antivirus, !!a.usb, !!a.paginasNoAutorizadas, !!a.escritorio, !!a.tiempoBloqueo, !!a.glpiAntivirus]); await connection.commit(); return reply(200, { message: 'Equipo actualizado.' }); } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
    }
    if (method === 'DELETE' && hasId) { const [r] = await db.execute('DELETE FROM equipos WHERE id=?', [Number(id)]); if (!r.affectedRows) return reply(404, { error: 'Equipo no encontrado.' }); return reply(200, { message: 'Equipo eliminado.' }); }
    return reply(405, { error: 'Método no permitido.' });
  } catch (e) { console.error('Error MySQL en equipos', { code: e.code, errno: e.errno, message: e.message, syscall: e.syscall, address: e.address, port: e.port }); if (e.code === 'ER_DUP_ENTRY') return reply(409, { error: 'El número de serie o la dirección IP ya están registrados.' }); return reply(500, { error: 'No fue posible conectar o consultar MySQL.', code: e.code || 'DB_UNKNOWN' }); }
}
