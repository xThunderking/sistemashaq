import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

const client = new RDSDataClient({ region: process.env.AWS_REGION });
const config = () => ({ resourceArn: process.env.AURORA_RESOURCE_ARN, secretArn: process.env.AURORA_SECRET_ARN, database: process.env.AURORA_DATABASE });
const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const param = (name, value, type = 'stringValue') => ({ name, value: { [type]: value } });
const sql = (statement, parameters = []) => client.send(new ExecuteStatementCommand({ ...config(), sql: statement, parameters, includeResultMetadata: true, formatRecordsAs: 'JSON' }));

export async function handler(event) {
  if (!process.env.AURORA_RESOURCE_ARN || !process.env.AURORA_SECRET_ARN || !process.env.AURORA_DATABASE) return reply(500, { error: 'Falta configurar la conexión con Aurora.' });
  const method = event.httpMethod;
  const lastPart = event.path.split('/').filter(Boolean).at(-1);
  const hasId = /^\d+$/.test(lastPart);
  try {
    if (method === 'GET' && !hasId) {
      const result = await sql('SELECT id, nombre, created_at AS createdAt FROM areas ORDER BY nombre');
      return reply(200, JSON.parse(result.formattedRecords || '[]'));
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const nombre = body.nombre?.trim().toUpperCase();
      if (!nombre) return reply(400, { error: 'El nombre del área es obligatorio.' });
      if (nombre.length > 100) return reply(400, { error: 'El nombre no puede exceder 100 caracteres.' });
      const result = await sql('INSERT INTO areas (nombre) VALUES (:nombre)', [param('nombre', nombre)]);
      return reply(201, { id: Number(result.generatedFields?.[0]?.longValue), nombre });
    }
    if (method === 'DELETE' && hasId) {
      const areaResult = await sql('SELECT nombre FROM areas WHERE id=:id', [param('id', Number(lastPart), 'longValue')]);
      const area = JSON.parse(areaResult.formattedRecords || '[]')[0];
      if (!area) return reply(404, { error: 'Área no encontrada.' });
      const usageResult = await sql('SELECT COUNT(*) AS total FROM equipos WHERE area=:nombre', [param('nombre', area.nombre)]);
      const usage = Number(JSON.parse(usageResult.formattedRecords || '[]')[0]?.total || 0);
      if (usage > 0) return reply(409, { error: `No se puede eliminar: hay ${usage} equipo${usage === 1 ? '' : 's'} en esta área.` });
      await sql('DELETE FROM areas WHERE id=:id', [param('id', Number(lastPart), 'longValue')]);
      return reply(200, { message: 'Área eliminada.' });
    }
    return reply(405, { error: 'Método no permitido.' });
  } catch (error) {
    console.error(error);
    if (error.name === 'DatabaseErrorException' && error.message?.includes('Duplicate')) return reply(409, { error: 'Esta área ya está registrada.' });
    return reply(500, { error: 'Ocurrió un error al consultar las áreas.' });
  }
}
