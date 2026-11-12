"""Vistas laterales de geometría sin emisión, transmisión ni reflejos metálicos."""
import bpy
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'blender/scripts'))
from common import ROOT, aim
scene=bpy.context.scene
material=bpy.data.materials.new('QA_arcilla_neutra');material.use_nodes=True
material.node_tree.nodes.clear()
node=material.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
output=material.node_tree.nodes.new('ShaderNodeOutputMaterial')
material.node_tree.links.new(node.outputs['BSDF'],output.inputs['Surface'])
node.inputs['Base Color'].default_value=(.24,.24,.24,1)
node.inputs['Roughness'].default_value=.7;node.inputs['Metallic'].default_value=0
for layer in scene.view_layers:layer.material_override=material
for obj in bpy.data.objects:
    if obj.type=='LIGHT':obj.data.color=(1,1,1)
scene.render.use_compositing=False
for name,position in [('left',(-6,0,-.093)),('right',(6,0,-.093))]:
    scene.camera.location=position;aim(scene.camera,(0,0,-.093))
    scene.render.filepath=str(ROOT/f'previews/reconstruction/clay-side-{name}-v5.png')
    bpy.ops.render.render(write_still=True)
