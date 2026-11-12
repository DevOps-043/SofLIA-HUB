"""Exportar únicamente el personaje y sus seis pistas NLA."""
import bpy
from common import ROOT, set_state


def export_glb(root):
    for obj in root.children_recursive:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:track.mute=False
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for obj in root.children_recursive:obj.select_set(True)
    path=ROOT/'assets/glb/soflia_agent.glb';path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,
        export_optimize_animation_size=False,export_optimize_animation_keep_anim_object=True,
        export_force_sampling=True,export_lights=False,export_cameras=False,export_extras=True,
        export_yup=True,export_materials='EXPORT')
    set_state('idle')
    return path
