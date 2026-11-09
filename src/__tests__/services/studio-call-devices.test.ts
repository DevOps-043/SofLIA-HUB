import { describe,expect,it,vi } from 'vitest';
import { callDevices } from '../../../packages/zoom-runtime/call-devices';

function setup(audio=false,camera=false){
  const stream={getMicList:()=>[{deviceId:'mic',label:'USB'}],getSpeakerList:()=>[{deviceId:'speaker',label:'Auriculares'}],getCameraList:()=>[{deviceId:'camera',label:'Webcam'}],getActiveMicrophone:()=> 'mic',getActiveSpeaker:()=> 'speaker',getActiveCamera:()=> 'camera',switchMicrophone:vi.fn(),switchSpeaker:vi.fn(),switchCamera:vi.fn()};
  const checked=async(value:unknown)=>{await value;};
  const devices=callDevices(stream as unknown as Parameters<typeof callDevices>[0],()=>({audio,camera}),checked);
  return {devices,stream};
}
describe('dispositivos reales de la llamada',()=>{
  it('selecciona fuentes apagadas sin iniciar captura y aplica opciones en su activación',async()=>{
    const {devices,stream}=setup();expect(devices.audioOptions()).toEqual({});expect(devices.videoOptions()).toEqual({});
    await devices.select({kind:'microphone',id:'mic'});await devices.select({kind:'speaker',id:'speaker'});await devices.select({kind:'camera',id:'camera'});
    expect(stream.switchMicrophone).not.toHaveBeenCalled();expect(stream.switchCamera).not.toHaveBeenCalled();expect(devices.audioOptions()).toEqual({microphoneId:'mic',speakerId:'speaker'});expect(devices.videoOptions()).toEqual({cameraId:'camera'});
  });
  it('cambia entrada/salida/cámara activas con métodos del SDK y devuelve selección confirmada',async()=>{
    const {devices,stream}=setup(true,true);
    await devices.select({kind:'microphone',id:'mic'});await devices.select({kind:'speaker',id:'speaker'});await devices.select({kind:'camera',id:'camera'});
    expect(stream.switchMicrophone).toHaveBeenCalledWith('mic');expect(stream.switchSpeaker).toHaveBeenCalledWith('speaker');expect(stream.switchCamera).toHaveBeenCalledWith('camera');expect(devices.list()).toMatchObject({input:'mic',output:'speaker',camera:'camera'});
  });
  it('rechaza un dispositivo retirado, payload extra o tipo desconocido',async()=>{
    const {devices,stream}=setup(true,true);
    for(const payload of [{kind:'microphone',id:'gone'},{kind:'camera',id:'camera',url:'https://otro.test'},{kind:'screen',id:'camera'}])await expect(devices.select(payload)).rejects.toThrow();
    expect(stream.switchMicrophone).not.toHaveBeenCalled();expect(stream.switchCamera).not.toHaveBeenCalled();
  });
  it('conserva selección anterior si Zoom rechaza el cambio',async()=>{
    const {devices,stream}=setup(true,true);stream.switchCamera.mockRejectedValue(new Error('permisos'));await expect(devices.select({kind:'camera',id:'camera'})).rejects.toThrow('permisos');expect(devices.videoOptions()).toEqual({});
  });
});
