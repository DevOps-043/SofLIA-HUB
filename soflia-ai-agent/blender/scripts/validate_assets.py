"""Validación estructural sin dependencias externas."""
import json
import struct
from pathlib import Path

REQUIRED=['SOFLIA_ROOT','BODY_MAIN','FACE_DISPLAY','EYE_LEFT','EYE_RIGHT','SHELL_UPPER','SHELL_LOWER','FLOW_BAND_LEFT','FLOW_BAND_RIGHT','LOGO_SOFLIA','STATUS_INDICATORS','LIGHT_EMISSIVE','RIG_CONTROLLER']


def validate_assets(path):
    data=Path(path).read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data),'Cabecera GLB inválida'
    chunk_size,chunk_type=struct.unpack_from('<II',data,12)
    assert chunk_type==0x4e4f534a
    doc=json.loads(data[20:20+chunk_size])
    names={n.get('name') for n in doc['nodes']}
    assert not set(REQUIRED)-names,f'Faltan nodos: {set(REQUIRED)-names}'
    clips={a['name']:len(a['channels']) for a in doc['animations']}
    expected={'STATE_'+s for s in ['IDLE','LISTENING','THINKING','SPEAKING','SUCCESS','WARNING']}
    assert set(clips)==expected,f'Clips inesperados: {clips}'
    assert all(n>5 for n in clips.values()),'Animación vacía'
    signatures=[json.dumps(a['samplers'],sort_keys=True) for a in doc['animations']]
    assert len(set(signatures))==6,'Animaciones duplicadas'
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    return {'bytes':length,'triangles':triangles,'clips':clips,'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'materials':len(doc['materials'])}
