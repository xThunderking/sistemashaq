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
const validate = b => !b?.serialNumber?.trim() ? 'El número de serie es obligatorio.' : !b?.area?.trim() ? 'El área es obligatoria.' : !b?.responsable?.trim() ? 'El responsable es obligatorio.' : null;

export async function handler(event) {
  const id = event.path.split('/').filter(Boolean).at(-1), hasId = /^\d+$/.test(id), method = event.httpMethod;
  try {
    const db = getPool();
    if (method === 'GET' && !hasId) { const [rows] = await db.execute('SELECT id, serial_number AS serialNumber, area, responsable, created_at AS createdAt FROM laptops ORDER BY created_at DESC'); return reply(200, rows); }
    if (method === 'POST') { const b = JSON.parse(event.body || '{}'), error = validate(b); if (error) return reply(400, { error }); const [r] = await db.execute('INSERT INTO laptops (serial_number, area, responsable) VALUES (?, ?, ?)', [b.serialNumber.trim().toUpperCase(), b.area.trim(), b.responsable.trim()]); return reply(201, { id: r.insertId }); }
    if (method === 'PUT' && hasId) { const b = JSON.parse(event.body || '{}'), error = validate(b); if (error) return reply(400, { error }); const [r] = await db.execute('UPDATE laptops SET serial_number=?, area=?, responsable=? WHERE id=?', [b.serialNumber.trim().toUpperCase(), b.area.trim(), b.responsable.trim(), Number(id)]); if (!r.affectedRows) return reply(404, { error: 'Laptop no encontrada.' }); return reply(200, { message: 'Laptop actualizada.' }); }
    if (method === 'DELETE' && hasId) { const [r] = await db.execute('DELETE FROM laptops WHERE id=?', [Number(id)]); if (!r.affectedRows) return reply(404, { error: 'Laptop no encontrada.' }); return reply(200, { message: 'Laptop eliminada.' }); }
    return reply(405, { error: 'Método no permitido.' });
  } catch (error) { console.error('Error MySQL en laptops', { code: error.code, message: error.message }); if (error.code === 'ER_DUP_ENTRY') return reply(409, { error: 'Ya existe una laptop con este número de serie.' }); return reply(500, { error: 'No fue posible consultar las laptops.', code: error.code }); }
}
