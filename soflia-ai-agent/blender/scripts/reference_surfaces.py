"""Superficies volumétricas desde contornos de referencia; ninguna imagen es geometría.

Coordenadas de control: píxel X, píxel Y, profundidad Blender. La proyección frontal
se conserva; la profundidad, especialmente posterior, es una hipótesis editable.
"""
import math
import bmesh
from mathutils import Vector
from common import mesh


def reference_point(point):
    x,z,y=point
    return Vector(((x-656)/480,y,(555-z)/480))


def curve(points,count,closed=False):
    controls=[reference_point(point) for point in points]
    output=[]
    for step in range(count):
        t=step/(count if closed else count-1)*(len(controls) if closed else len(controls)-1)
        index=min(int(t),len(controls)-1 if closed else len(controls)-2);u=t-index
        def get(i):return controls[i%len(controls)] if closed else controls[max(0,min(len(controls)-1,i))]
        a,b,c,d=(get(index+i) for i in (-1,0,1,2))
        output.append(.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u))
    return output


def finish(name,vertices,faces,mat,parent):
    obj=mesh(name,vertices,faces,mat,parent)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
    obj['origen_geometrico']='Contornos de la referencia aprobada, con profundidad explícita y reverso cerrado'
    return obj


def volume(name,outline,center,mat,parent,back_depth=.35,thickness=.025,segments=112,rings=10,bulge=.06):
    boundary=curve(outline,segments,True);origin=reference_point(center)
    vertices=[];faces=[]
    # Dos superficies con un polo real y anillos sin vértices degenerados.
    for side in (0,1):
        vertices.append(tuple(origin+Vector((0,back_depth+thickness if side else 0,0))))
        for ring in range(1,rings+1):
            r=ring/rings
            for end in boundary:
                p=origin.lerp(end,r)
                p.y=origin.y*(1-r*r)+end.y*r*r-bulge*math.sin(math.pi*r)**2
                if side:p.y+=thickness+back_depth*(1-r*r)
                vertices.append(tuple(p))
    size=1+rings*segments
    for side in (0,1):
        offset=side*size
        for i in range(segments):faces.append((offset,offset+1+i,offset+1+(i+1)%segments))
        for ring in range(rings-1):
            for i in range(segments):
                a=offset+1+ring*segments+i;b=offset+1+ring*segments+(i+1)%segments
                faces.append((a,b,b+segments,a+segments))
    start=1+(rings-1)*segments
    for i in range(segments):
        a=start+i;b=start+(i+1)%segments;faces.append((a,b,b+size,a+size))
    return finish(name,vertices,faces,mat,parent)


def ribbon(name,outer,inner,mat,parent,edge_mat=None,segments=88,width_steps=6,thickness=.025,back_bulge=0):
    a=curve(outer,segments);b=curve(inner,segments)
    for index,neighbor in [(0,1),(-1,-2)]:
        if (a[index]-b[index]).length<.001:
            a[index]=a[index].lerp(a[neighbor],.03);b[index]=b[index].lerp(b[neighbor],.03)
    vertices=[];faces=[]
    for side in (0,1):
        for i in range(segments):
            for j in range(width_steps+1):
                t=j/width_steps;p=a[i].lerp(b[i],t)
                p.y-=.04*math.sin(math.pi*t)
                if side:p.y+=thickness+back_bulge*math.sin(math.pi*t)
                vertices.append(tuple(p))
    stride=width_steps+1;size=segments*stride
    for side in (0,1):
        for i in range(segments-1):
            for j in range(width_steps):
                index=side*size+i*stride+j;faces.append((index,index+1,index+stride+1,index+stride))
    for i in range(segments-1):
        for j in (0,width_steps):
            index=i*stride+j;faces.append((index,index+stride,index+stride+size,index+size))
    for i in (0,segments-1):
        for j in range(width_steps):
            index=i*stride+j;faces.append((index,index+1,index+1+size,index+size))
    obj=finish(name,vertices,faces,mat,parent)
    if edge_mat:
        obj.data.materials.append(edge_mat)
        # Filete de la propia superficie: no tubos añadidos ni geometría flotante.
        # Sólo el canto lateral lleva emisión: la cara conserva detalle PBR.
        for polygon in list(obj.data.polygons)[2*(segments-1)*width_steps:]:polygon.material_index=1
    return obj
