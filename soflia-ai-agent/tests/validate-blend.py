"""Abrir con Blender --background archivo.blend --python validate-blend.py."""
import bpy
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'blender/scripts'))
from validate_assets import REQUIRED
assert all(name in bpy.data.objects for name in REQUIRED),'Faltan componentes editables'
root=bpy.data.objects['SOFLIA_ROOT']
assert root.children_recursive,'El modelo carece de geometría'
expected={'STATE_'+s for s in ['IDLE','LISTENING','THINKING','SPEAKING','SUCCESS','WARNING']}
tracks={track.name for obj in bpy.data.objects if obj.animation_data for track in obj.animation_data.nla_tracks}
assert tracks==expected,f'Faltan estados editables: {tracks}'
assert bpy.context.scene.camera is not None,'Falta cámara de estudio'
assert bpy.context.scene.render.engine=='BLENDER_EEVEE'
curves=sum(obj.type=='CURVE' for obj in root.children_recursive)
assert curves>0 if 'master' in bpy.data.filepath else curves==0
print(json.dumps({'archivo':bpy.data.filepath,'componentes':len(root.children_recursive),'estados':sorted(tracks),'curvasEditables':curves,'version':bpy.app.version_string}))
