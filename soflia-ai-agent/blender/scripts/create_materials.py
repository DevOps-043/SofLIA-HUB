"""Materiales Principled compatibles con glTF, sin nodos propietarios."""
import bpy


def material(name, color, metallic=0, roughness=.3, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    if name=='Pantalla_obsidiana':node.inputs['Specular IOR Level'].default_value=.045
    return mat


def create_materials():
    return {
        'navy': material('Marino_satinado', (.010, .027, .064), .32, .36),
        'edge': material('Borde_azul', (.020, .058, .12), .25, .38),
        'face': material('Pantalla_obsidiana', (.0008, .003, .005), .0, .50),
        'teal': material('Turquesa_satinado', (.0, .35, .38), .10, .26, .12),
        'glow': material('Luz_turquesa', (.0, .55, .65), .08, .35, 1.25),
        'white': material('Ojos_luminosos', (.005, .65, .78), .0, .35, 1.8),
        'amber': material('Advertencia_ambar', (1, .46, .045), .2, .3, 2.5),
        'logo_navy': material('Logo_marino_original', (.003, .034, .067), .4, .25),
        'logo_teal': material('Logo_turquesa_original', (.0, .62, .51), .4, .27, .35),
    }
