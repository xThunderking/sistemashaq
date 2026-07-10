import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

const client = new RDSDataClient({ region: process.env.AWS_REGION });
const config = () => ({resourceArn:process.env.AURORA_RESOURCE_ARN,secretArn:process.env.AURORA_SECRET_ARN,database:process.env.AURORA_DATABASE});
const reply = (statusCode, body) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const param = (name,value,type='stringValue') => ({name,value:{[type]:value}});
const ipValid = ip => {const p=ip.split('.');return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255)};
const validate = b => !b?.serialNumber?.trim()?'El número de serie es obligatorio.':!b?.area?.trim()?'El área es obligatoria.':!ipValid(b?.ipAddress?.trim()||'')?'La dirección IP no es válida.':null;
async function sql(statement,parameters=[]){return client.send(new ExecuteStatementCommand({...config(),sql:statement,parameters,includeResultMetadata:true,formatRecordsAs:'JSON'}))}

export async function handler(event){
  if(!process.env.AURORA_RESOURCE_ARN||!process.env.AURORA_SECRET_ARN||!process.env.AURORA_DATABASE)return reply(500,{error:'Falta configurar la conexión con Aurora.'});
  const method=event.httpMethod;const id=event.path.split('/').filter(Boolean).at(-1);const hasId=/^\d+$/.test(id);
  try{
    if(method==='GET'&&!hasId){const r=await sql('SELECT id, serial_number AS serialNumber, area, ip_address AS ipAddress, created_at AS createdAt FROM equipos ORDER BY created_at DESC');return reply(200,JSON.parse(r.formattedRecords||'[]'))}
    if(method==='POST'){
      const b=JSON.parse(event.body||'{}'),error=validate(b);if(error)return reply(400,{error});
      const r=await sql('INSERT INTO equipos (serial_number, area, ip_address) VALUES (:serial, :area, :ip)',[param('serial',b.serialNumber.trim()),param('area',b.area.trim()),param('ip',b.ipAddress.trim())]);return reply(201,{id:Number(r.generatedFields?.[0]?.longValue),message:'Equipo registrado.'});
    }
    if(method==='PUT'&&hasId){const b=JSON.parse(event.body||'{}'),error=validate(b);if(error)return reply(400,{error});const r=await sql('UPDATE equipos SET serial_number=:serial, area=:area, ip_address=:ip WHERE id=:id',[param('serial',b.serialNumber.trim()),param('area',b.area.trim()),param('ip',b.ipAddress.trim()),param('id',Number(id),'longValue')]);if(!r.numberOfRecordsUpdated)return reply(404,{error:'Equipo no encontrado.'});return reply(200,{message:'Equipo actualizado.'})}
    if(method==='DELETE'&&hasId){const r=await sql('DELETE FROM equipos WHERE id=:id',[param('id',Number(id),'longValue')]);if(!r.numberOfRecordsUpdated)return reply(404,{error:'Equipo no encontrado.'});return reply(200,{message:'Equipo eliminado.'})}
    return reply(405,{error:'Método no permitido.'});
  }catch(e){console.error(e);if(e.name==='DatabaseErrorException'&&e.message?.includes('Duplicate'))return reply(409,{error:'El número de serie o la dirección IP ya están registrados.'});return reply(500,{error:'Ocurrió un error al consultar la base de datos.'})}
}
