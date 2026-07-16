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
const generations = ['novena', 'decima'];
const validate = body => !body?.area?.trim() ? 'El área es obligatoria.' : !body?.responsable?.trim() ? 'El responsable es obligatorio.' : !generations.includes(body?.generation) ? 'Selecciona una generación válida.' : null;

export async function handler(event) {
  const id = event.path.split('/').filter(Boolean).at(-1), hasId = /^\d+$/.test(id), method = event.httpMethod;
  try {
    const db = getPool();
    if (method === 'GET' && !hasId) { const [rows] = await db.execute('SELECT id, serial_number AS serialNumber, area, responsable, generacion AS generation, created_at AS createdAt FROM ipads ORDER BY created_at DESC'); return reply(200, rows); }
    if (method === 'POST') { const body = JSON.parse(event.body || '{}'), error = validate(body); if (error) return reply(400, { error }); const serial = body.serialNumber?.trim().toUpperCase() || null; const [result] = await db.execute('INSERT INTO ipads (serial_number, area, responsable, generacion) VALUES (?, ?, ?, ?)', [serial, body.area.trim(), body.responsable.trim(), body.generation]); return reply(201, { id: result.insertId }); }
    if (method === 'PUT' && hasId) { const body = JSON.parse(event.body || '{}'), error = validate(body); if (error) return reply(400, { error }); const serial = body.serialNumber?.trim().toUpperCase() || null; const [result] = await db.execute('UPDATE ipads SET serial_number=?, area=?, responsable=?, generacion=? WHERE id=?', [serial, body.area.trim(), body.responsable.trim(), body.generation, Number(id)]); if (!result.affectedRows) return reply(404, { error: 'iPad no encontrado.' }); return reply(200, { message: 'iPad actualizado.' }); }
    if (method === 'DELETE' && hasId) { const [result] = await db.execute('DELETE FROM ipads WHERE id=?', [Number(id)]); if (!result.affectedRows) return reply(404, { error: 'iPad no encontrado.' }); return reply(200, { message: 'iPad eliminado.' }); }
    return reply(405, { error: 'Método no permitido.' });
  } catch (error) { console.error('Error MySQL en iPads', { code: error.code, message: error.message }); if (error.code === 'ER_DUP_ENTRY') return reply(409, { error: 'Ya existe un iPad con este número de serie.' }); return reply(500, { error: 'No fue posible consultar los iPads.', code: error.code }); }
}
