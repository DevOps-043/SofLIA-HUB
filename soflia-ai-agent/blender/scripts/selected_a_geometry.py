"""Geometría nueva para la propuesta A seleccionada: un único volumen sin casco.

Las proporciones provienen de la lámina A; ninguna malla V2–V5 participa. El visor
es una región de material de la misma superficie. La profundidad posterior es una
decisión de loft coherente con la vista lateral conceptual, no un dato observado.
"""
import math
import bmesh
import bpy

PARAMETERS={
    'width':2.40,'height':1.56,'front_depth':.66,'rear_depth':.72,
    'visor_center':[.045,.14],'visor_half_size':[.96,.48],
    'outline_segments':256,'front_rings':24,'grey_rings':24,'rear_rings':48,
}


def frame(t):
    s=math.sin(t);c=math.cos(t)
    z=.78*c-.08*s*s
    power=2.2+1.2*(1-math.tanh(4*c))*.5
    rx=1.20*max(0,s)**(2/power)
    cx=.025*c-.025*s*s
    cy=.03+.055*c
    front=.66*max(0,s)**(2/power)*(1-.08*c)
    rear=.72*max(0,s)**(2/(power+.15))*(1+.02*c)
    return z,rx,cx,cy,front,rear


def section(z):
    lo,hi=0.,math.pi
    for _ in range(38):
        mid=(lo+hi)*.5
        if frame(mid)[0]>z:lo=mid
        else:hi=mid
    return frame((lo+hi)*.5)


def surface_y(x,z,front=True):
    _,rx,cx,cy,fd,rd=section(z)
    q=min(1,abs((x-cx)/max(1e-8,rx)))
    power=2.6 if front else 2.2
    depth=(fd if front else rd)*max(0,1-q**power)**(1/power)
    if front:
        # Ensanchamiento de la propia piel inferior: el flujo no es una cinta.
        flow=.025*math.exp(-((z+.45)/.24)**2-((x+.35)/.8)**2)*(1-q*q)
        return cy-depth-flow
    flow=.016*math.exp(-((z-.02)/.55)**2-((x-.20)/.85)**2)*(1-q*q)
    return cy+depth+flow


def outline(samples=1200):
    points=[]
    for side in (1,-1):
        ts=[math.pi*i/(samples//2) for i in range(samples//2+1)]
        if side==-1:ts.reverse()
        for t in ts:
            z,rx,cx,_,_,_=frame(t);points.append((cx+side*rx,z))
    return points


def ray_radius(points,cx,cz,dx,dz):
    hits=[]
    for index,a in enumerate(points):
        b=points[(index+1)%len(points)]
        ex,ez=b[0]-a[0],b[1]-a[1]
        determinant=dx*ez-dz*ex
        if abs(determinant)<1e-12:continue
        ax,az=a[0]-cx,a[1]-cz
        radius=(ax*ez-az*ex)/determinant
        u=(ax*dz-az*dx)/determinant
        if radius>0 and -1e-8<=u<=1+1e-8:hits.append(radius)
    if not hits:raise ValueError('El rayo no corta el contorno de A')
    return min(hits)


def make_mesh(name,vertices,faces,materials,parent,material_ids=None):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.parent=parent
    for material in materials:data.materials.append(material)
    for index,face in enumerate(data.polygons):
        face.use_smooth=True
        if material_ids:face.material_index=material_ids[index]
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(data);bm.free()
    return obj


def create_body(materials,parent):
    segments=PARAMETERS['outline_segments'];n=PARAMETERS['front_rings'];grey=PARAMETERS['grey_rings']
    cx,cz=PARAMETERS['visor_center'];ax,az=PARAMETERS['visor_half_size']
    contour=outline();vertices=[(cx,surface_y(cx,cz),cz)];faces=[];ids=[]
    outer=[];inner=[];directions=[]
    for i in range(segments):
        angle=2*math.pi*i/segments;dx,dz=math.sin(angle),math.cos(angle)
        # Superelipse de la región oscura, medida sobre la lámina seleccionada.
        radius=1/((abs(dx)/ax)**2.2+(abs(dz)/az)**2.2)**(1/2.2)
        body_radius=ray_radius(contour,cx,cz,dx,dz)
        if radius>=body_radius:raise ValueError('El visor excede la silueta seleccionada')
        inner.append(radius);outer.append(body_radius);directions.append((dx,dz))
    for ring in range(1,n+grey+1):
        for i,(dx,dz) in enumerate(directions):
            if ring<=n:r=inner[i]*ring/n
            else:r=inner[i]+(outer[i]-inner[i])*math.sin(math.pi*.5*(ring-n)/grey)
            x,z=cx+dx*r,cz+dz*r
            y=section(z)[3] if ring==n+grey else surface_y(x,z)
            vertices.append((x,y,z))
    for i in range(segments):faces.append((0,1+i,1+(i+1)%segments));ids.append(1)
    for ring in range(n+grey-1):
        for i in range(segments):
            a=1+ring*segments+i;b=1+ring*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments));ids.append(1 if ring<n-1 else 0)
    boundary_start=1+(n+grey-1)*segments
    back_center=len(vertices);vertices.append((cx,surface_y(cx,cz,False),cz))
    previous=None;rear=PARAMETERS['rear_rings']
    for ring in range(1,rear):
        current=len(vertices)
        for i,(dx,dz) in enumerate(directions):
            r=outer[i]*math.sin(math.pi*.5*ring/rear);x,z=cx+dx*r,cz+dz*r
            vertices.append((x,surface_y(x,z,False),z))
        for i in range(segments):
            j=(i+1)%segments
            if previous is None:faces.append((back_center,current+i,current+j))
            else:faces.append((previous+i,previous+j,current+j,current+i))
            ids.append(0)
        previous=current
    for i in range(segments):
        j=(i+1)%segments;faces.append((previous+i,previous+j,boundary_start+j,boundary_start+i));ids.append(0)
    obj=make_mesh('BODY_MAIN',vertices,faces,materials,parent,ids)
    region=obj.vertex_groups.new(name='FACE_DISPLAY')
    region.add(list(range(1+n*segments)),1,'REPLACE')
    obj['design']='A — Núcleo horizontal, selección explícita del usuario'
    obj['visor']='Región de material sobre la misma malla continua; sin marco ni tapa'
    obj['flow']='Cambio suave de curvatura de la zona inferior, integrado en el cuerpo'
    obj['new_geometry']=True
    return obj


def create_eye(name,x,material,parent):
    width=.38;baseline=.145;vertices=[];faces=[];steps=48
    for layer in (0,1):
        for i in range(steps+1):
            t=i/steps;xx=x+(t-.5)*width
            for zz in (.075*math.sin(math.pi*t)**.9-.006,.115*math.sin(math.pi*t)**.75):
                z=baseline+zz;y=surface_y(xx,z)-.008+layer*.004
                vertices.append((xx,y,z))
    size=2*(steps+1)
    for layer in (0,1):
        for i in range(steps):
            a=layer*size+i*2;faces.append((a,a+1,a+3,a+2))
    for i in range(steps):
        for j in (0,1):
            a=2*i+j;faces.append((a,a+2,a+2+size,a+size))
    for i in (0,steps):
        a=2*i;faces.append((a,a+1,a+1+size,a+size))
    return make_mesh(name,vertices,faces,[material],parent)


def create_selected_a(materials):
    root=bpy.data.objects.new('SOFLIA_A_ROOT',None);bpy.context.collection.objects.link(root)
    body=create_body([materials['body'],materials['display']],root)
    left=create_eye('EYE_LEFT',-.36,materials['eyes'],root)
    right=create_eye('EYE_RIGHT',.44,materials['eyes'],root)
    return root,body,[left,right]
