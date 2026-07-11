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
const clean = value => String(value || '').replace(/<\/td>\s*<td>/gi, ': ').replace(/<\/tr>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n\s*\n/g, '\n').trim();
const normalize = row => ({ serialNumber: row.serialNumber, modelo: row.modelo || 'No disponible', mtm: row.mtm || 'No disponible', familia: row.familia || 'No disponible', configuracionOriginal: row.configuracionOriginal || 'No disponible', estadoGarantia: row.estadoGarantia || 'No disponible', inicioGarantia: row.inicioGarantia, finGarantia: row.finGarantia, cached: true });

export async function handler(event) {
  const id = event.path.split('/').filter(Boolean).at(-1);
  if (event.httpMethod !== 'GET' || !/^\d+$/.test(id)) return reply(405, { error: 'Solicitud no permitida.' });
  try {
    const db = getPool();
    const [saved] = await db.execute(`SELECT e.serial_number AS serialNumber, i.modelo, i.mtm, i.familia,
      i.configuracion_original AS configuracionOriginal, i.estado_garantia AS estadoGarantia,
      i.inicio_garantia AS inicioGarantia, i.fin_garantia AS finGarantia
      FROM equipos e JOIN informacion_lenovo i ON i.equipo_id=e.id WHERE e.id=?`, [Number(id)]);
    if (saved[0]) return reply(200, normalize(saved[0]));

    const [equipos] = await db.execute('SELECT serial_number AS serialNumber FROM equipos WHERE id=?', [Number(id)]);
    if (!equipos[0]) return reply(404, { error: 'Equipo no encontrado.' });
    const serial = equipos[0].serialNumber.trim().toUpperCase();
    const response = await fetch('https://pcsupport.lenovo.com/us/en/api/v4/upsell/redport/getIbaseInfo', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ serialNumber: serial, country: 'us', language: 'en' }), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Object.assign(new Error(`Lenovo respondió ${response.status}`), { code: 'LENOVO_HTTP_ERROR' });
    const result = await response.json();
    const data = result?.data, machine = data?.machineInfo;
    if (!machine) return reply(404, { error: 'Lenovo no encontró información para este número de serie.', code: 'LENOVO_NOT_FOUND' });

    const warranties = [...(data.baseWarranties || []), ...(data.upgradeWarranties || []), ...(data.warranties || [])];
    const starts = warranties.map(w => w.startDate).filter(Boolean).sort();
    const ends = warranties.map(w => w.endDate).filter(Boolean).sort();
    const start = starts[0] || machine.baseStartDate || null, end = ends.at(-1) || machine.eosDate || null;
    const active = end ? new Date(`${end}T23:59:59Z`) >= new Date() : false;
    const warranty = end ? `${active ? 'Vigente' : 'Vencida'}${end ? ` · finaliza ${end}` : ''}` : 'No disponible';
    const info = {
      serialNumber: serial, modelo: machine.productName || machine.model || 'No disponible',
      mtm: machine.product || `${machine.type || ''}${machine.model || ''}` || 'No disponible',
      familia: String(machine.series || machine.brand || '').replaceAll('-', ' ') || 'No disponible',
      configuracionOriginal: clean(machine.specification) || 'No disponible', estadoGarantia: warranty,
      inicioGarantia: start, finGarantia: end, cached: false
    };
    await db.execute(`INSERT INTO informacion_lenovo
      (equipo_id, modelo, mtm, familia, configuracion_original, estado_garantia, inicio_garantia, fin_garantia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [Number(id), info.modelo, info.mtm, info.familia, info.configuracionOriginal, info.estadoGarantia, start, end]);
    return reply(200, info);
  } catch (error) {
    console.error('Error consultando Lenovo', { code: error.code, message: error.message });
    if (error.code === 'ER_NO_SUCH_TABLE') return reply(500, { error: 'Falta ejecutar la consulta para crear informacion_lenovo.', code: error.code });
    return reply(502, { error: 'No fue posible consultar Lenovo en este momento.', code: error.code || 'LENOVO_UNAVAILABLE' });
  }
}
