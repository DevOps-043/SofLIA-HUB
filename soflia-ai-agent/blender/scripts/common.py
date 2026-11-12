"""Utilidades pequeñas del generador; coordenadas Blender: frente -Y, arriba Z."""
from pathlib import Path
import bpy
import math

ROOT = Path(__file__).resolve().parents[2]
STATES = {'idle': 4, 'listening': 3, 'thinking': 3, 'speaking': 3, 'success': 2, 'warning': 2}
FPS = 24


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def mesh(name, vertices, faces, material, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(material)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj


def sphere(name, location, scale, material, parent, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.parent = parent
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def tube(name, points, radius, material, parent, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 2
    data.bevel_depth = radius
    data.bevel_resolution = 1
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(material)
    return obj


def aim(obj, target=(0, 0, 0)):
    from mathutils import Vector
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()


def set_state(name):
    for obj in bpy.data.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = track.name != 'STATE_' + name.upper()
    bpy.context.scene.frame_end = STATES[name]*FPS+1
    bpy.context.scene.frame_set(1)
