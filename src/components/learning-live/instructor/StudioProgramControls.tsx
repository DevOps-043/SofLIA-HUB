export function StudioProgramControls({camera,pending,audio,audioAvailable,sharing,label,onCamera,onAudio,onLabel}:{camera:boolean;pending:boolean;audio:boolean;audioAvailable:boolean;sharing:boolean;label:string;onCamera:()=>void;onAudio:()=>void;onLabel:(text:string)=>void}){
  return <fieldset className="studio-program-controls"><legend>Composición de salida</legend>
    <button type="button" disabled={pending} aria-pressed={camera} onClick={onCamera}>{camera?'Quitar cámara del programa':'Añadir cámara al programa'}</button>
    <button type="button" disabled={!audioAvailable||sharing} title={sharing?'Detén compartir antes de cambiar el audio del programa.':undefined} aria-pressed={audio} onClick={onAudio}>{audio?'Silenciar videos del programa':'Activar audio de videos'}</button>
    <label>Rótulo en pantalla<input value={label} maxLength={120} onChange={event=>onLabel(event.target.value)} placeholder="Nombre o tema de la sesión"/></label>
    {!audioAvailable&&<small>El audio del programa requiere una llamada compatible.</small>}
  </fieldset>;
}
