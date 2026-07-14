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
const ipValid = ip => { const parts = ip.split('.'); return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255); };
const validate = body => !body?.serialNumber?.trim() ? 'El número de serie es obligatorio.' : !body?.serverName?.trim() ? 'El nombre del servidor es obligatorio.' : !ipValid(body?.ipAddress?.trim() || '') ? 'La dirección IP no es válida.' : null;

export async function handler(event) {
  const id = event.path.split('/').filter(Boolean).at(-1), hasId = /^\d+$/.test(id), method = event.httpMethod;
  try {
    const db = getPool();
    if (method === 'GET' && !hasId) { const [rows] = await db.execute('SELECT id, serial_number AS serialNumber, nombre_servidor AS serverName, ip_address AS ipAddress, created_at AS createdAt FROM servidores ORDER BY nombre_servidor'); return reply(200, rows); }
    if (method === 'POST') { const body = JSON.parse(event.body || '{}'), error = validate(body); if (error) return reply(400, { error }); const [result] = await db.execute('INSERT INTO servidores (serial_number, nombre_servidor, ip_address) VALUES (?, ?, ?)', [body.serialNumber.trim().toUpperCase(), body.serverName.trim().toUpperCase(), body.ipAddress.trim()]); return reply(201, { id: result.insertId }); }
    if (method === 'PUT' && hasId) { const body = JSON.parse(event.body || '{}'), error = validate(body); if (error) return reply(400, { error }); const [result] = await db.execute('UPDATE servidores SET serial_number=?, nombre_servidor=?, ip_address=? WHERE id=?', [body.serialNumber.trim().toUpperCase(), body.serverName.trim().toUpperCase(), body.ipAddress.trim(), Number(id)]); if (!result.affectedRows) return reply(404, { error: 'Servidor no encontrado.' }); return reply(200, { message: 'Servidor actualizado.' }); }
    if (method === 'DELETE' && hasId) { const [result] = await db.execute('DELETE FROM servidores WHERE id=?', [Number(id)]); if (!result.affectedRows) return reply(404, { error: 'Servidor no encontrado.' }); return reply(200, { message: 'Servidor eliminado.' }); }
    return reply(405, { error: 'Método no permitido.' });
  } catch (error) { console.error('Error MySQL en servidores', { code: error.code, message: error.message }); if (error.code === 'ER_DUP_ENTRY') return reply(409, { error: error.message.includes('uq_servidores_ip') ? 'Ya existe un servidor con esta dirección IP.' : 'Ya existe un servidor con este número de serie.' }); return reply(500, { error: 'No fue posible consultar los servidores.', code: error.code }); }
}
