"""Controles editables y valores iniciales independientes de la lógica de IA."""
def create_rig(parts):
    rig=parts['rig']
    for name,value in {'audio_level':0.0,'light_intensity':1.0,'band_speed':1.0,'blink_speed':1.0,'horizontal_tilt':0.0,'vertical_tilt':0.0}.items():
        rig[name]=value
    rig['nota']='Los controles interactivos se aplican desde el controlador Three.js; las pistas NLA contienen los seis estados.'
    rig.empty_display_type='CIRCLE'
    rig.empty_display_size=1.4
