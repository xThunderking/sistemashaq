import mysql from 'mysql2/promise';
import awsCaBundle from 'aws-ssl-profiles';

let pool;
const getPool = () => pool ||= mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? undefined : { ...awsCaBundle, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  waitForConnections: true, connectionLimit: 3, queueLimit: 0, enableKeepAlive: true
});
const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

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
    if (method === 'GET' && !hasId) { const [rows] = await db.execute('SELECT id, nombre, created_at AS createdAt FROM areas ORDER BY nombre'); return reply(200, rows); }
    if (method === 'POST') { const b = JSON.parse(event.body || '{}'), nombre = b.nombre?.trim().toUpperCase(); if (!nombre) return reply(400, { error: 'El nombre del área es obligatorio.' }); if (nombre.length > 100) return reply(400, { error: 'El nombre no puede exceder 100 caracteres.' }); const [r] = await db.execute('INSERT INTO areas (nombre) VALUES (?)', [nombre]); return reply(201, { id: r.insertId, nombre }); }
    if (method === 'DELETE' && hasId) { const [found] = await db.execute('SELECT nombre FROM areas WHERE id=?', [Number(id)]); if (!found[0]) return reply(404, { error: 'Área no encontrada.' }); const [usageRows] = await db.execute('SELECT COUNT(*) AS total FROM equipos WHERE area=?', [found[0].nombre]); const usage = Number(usageRows[0].total); if (usage) return reply(409, { error: `No se puede eliminar: hay ${usage} equipo${usage === 1 ? '' : 's'} en esta área.` }); await db.execute('DELETE FROM areas WHERE id=?', [Number(id)]); return reply(200, { message: 'Área eliminada.' }); }
    return reply(405, { error: 'Método no permitido.' });
  } catch (e) { console.error('Error MySQL en áreas', { code: e.code, errno: e.errno, message: e.message, syscall: e.syscall, address: e.address, port: e.port }); if (e.code === 'ER_DUP_ENTRY') return reply(409, { error: 'Esta área ya está registrada.' }); return reply(500, { error: 'No fue posible conectar o consultar MySQL.', code: e.code || 'DB_UNKNOWN' }); }
}
