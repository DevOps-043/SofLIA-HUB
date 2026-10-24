import { useEffect } from 'react';
import SelectDropdown from '../../ui/SelectDropdown';
import { useStudioMediaRuntime } from './StudioMediaContext';

export function StudioCallDeviceSettings() {
  const media=useStudioMediaRuntime()!;
  const refresh=media.refreshCallDevices;
  useEffect(()=>{refresh?.();},[refresh]);
  const devices=media.callDevices;
  if(!media.callControls?.camera)return <p className="studio-muted">Configura entrada y salida desde los controles oficiales de Zoom. Las pruebas locales no cambian el audio de esta llamada.</p>;
  if(!devices)return <p role="status">Consultando los dispositivos de Zoom…</p>;
  const fields=[{kind:'microphone' as const,label:'Micrófono · entrada',value:devices.input,items:devices.microphones},{kind:'speaker' as const,label:'Altavoces · salida',value:devices.output,items:devices.speakers},{kind:'camera' as const,label:'Cámara',value:devices.camera,items:devices.cameras}];
  return <div className="studio-device-options"><p className="studio-muted">Dispositivos de la llamada. Si están apagados, la selección se aplicará al activarlos.</p>{fields.map(field=><label key={field.kind}>{field.label}<SelectDropdown aria-label={field.label} className="studio-select" value={field.value} placeholder="Dispositivo no disponible" onChange={id=>media.selectCallDevice?.({kind:field.kind,id})} options={[{value:'default',label:field.kind==='camera'?'Selección automática':'Predeterminado del sistema'},...field.items.filter(item=>item.id!=='default').map((item,index)=>({value:item.id,label:item.label||`Dispositivo ${index+1}`}))]}/></label>)}<button onClick={refresh}>Actualizar dispositivos de Zoom</button></div>;
}
