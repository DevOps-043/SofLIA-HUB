"""Carcasa continua y láminas escultóricas ancladas, sin toros ni polos interpolados."""
import math
from mathutils import Vector
from reference_surfaces import finish


def skin(phi, theta, scale=1.0):
    """Campo de forma compartido por carcasa, dorso y labios del visor."""
    s=math.sin(phi);c=math.cos(phi);co=math.cos(theta)
    rear=max(0,-co)**2
    x=.99*s*math.sin(theta)*(1+.03*c)+.035*c*c-.012*s*s
    y=-(.735+.015*c)*s*co
    z=.99*c+.005
    # Masa posterior asimétrica amplia, continuidad de las superficies frontales.
    x+=.025*rear*s**3*math.sin(2*theta+.7*phi)
    y+=.035*rear*s*s*(.65+.35*math.cos(2*theta+.8*phi))
    z+=.012*rear*s**3*math.sin(theta)
    return Vector((x*scale,y*scale,z*scale))


def skin_normal(phi,theta):
    if phi<.0001:return Vector((0,0,1))
    if phi>math.pi-.0001:return Vector((0,0,-1))
    dp=skin(phi+.0001,theta)-skin(phi-.0001,theta)
    dt=skin(phi,theta+.0001)-skin(phi,theta-.0001)
    normal=dp.cross(dt).normalized()
    if normal.dot(skin(phi,theta))<0:normal=-normal
    return normal


def crown_edge(theta):
    s=math.sin(theta);front=.39-.34*s-.20*s*s
    rear=-.48+.16*math.sin(theta+.9)+.08*math.sin(2*theta+1.1)
    blend=(1+math.tanh(4*math.cos(theta)))*.5
    height=front*blend+rear*(1-blend)
    return math.acos(max(-1,min(1,(height-.005)/.99)))


def hull(material,parent,segments=128,rings=64):
    vertices=[tuple(skin(0,0,.957))];faces=[]
    for i in range(1,rings):
        for j in range(segments):
            phi=math.pi*i/rings;theta=2*math.pi*j/segments;p=skin(phi,theta,.957)
            # Alojamiento real del visor: el volumen interior se retranquea para
            # no atravesar el vidrio ni reducir su abertura desde los laterales.
            lower_blend=max(0,min(1,(phi-2.06)/.20));lower_blend=lower_blend*lower_blend*(3-2*lower_blend)
            p.y+=.24*max(0,math.cos(theta))**1.2*math.exp(-((phi-1.65)/.72)**4)*(1-lower_blend)
            vertices.append(tuple(p))
    bottom=len(vertices);vertices.append(tuple(skin(math.pi,0,.957)))
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for i in range(rings-2):
        for j in range(segments):
            a=1+i*segments+j;b=1+i*segments+(j+1)%segments;faces.append((a,b,b+segments,a+segments))
    start=1+(rings-2)*segments
    for j in range(segments):faces.append((bottom,start+j,start+(j+1)%segments))
    return finish('BODY_MAIN',vertices,faces,material,parent)


def shell(name,material,parent,upper=True,segments=144,rings=42):
    vertices=[];faces=[];thickness=.032
    # Las dos caras son desplazamientos normales del mismo campo. No se mezcla
    # una proyección frontal con otra superficie: así no aparecen pliegues laterales.
    for layer in (0,1):
        pole_phi=0 if upper else math.pi
        offset=(.002 if upper else .004)-layer*thickness
        vertices.append(tuple(skin(pole_phi,0)+skin_normal(pole_phi,0)*offset))
        for i in range(1,rings+1):
            u=i/rings
            for j in range(segments):
                theta=2*math.pi*j/segments
                if upper:phi=crown_edge(theta)*u
                else:
                    front=(1+math.tanh(4*math.cos(theta)))*.5
                    border=(2.40-.05*math.sin(theta))*front+(crown_edge(theta)-.015)*(1-front)
                    phi=math.pi-(math.pi-border)*u
                vertices.append(tuple(skin(phi,theta)+skin_normal(phi,theta)*offset))
    size=1+rings*segments
    for layer in (0,1):
        start=layer*size
        for j in range(segments):faces.append((start,start+1+j,start+1+(j+1)%segments))
        for i in range(rings-1):
            for j in range(segments):
                a=start+1+i*segments+j;b=start+1+i*segments+(j+1)%segments
                faces.append((a,b,b+segments,a+segments))
    last=1+(rings-1)*segments
    # Radio del labio: puente redondeado en vez de un corte plano de una lámina.
    bridge=len(vertices)
    for j in range(segments):
        theta=2*math.pi*j/segments
        front=(1+math.tanh(4*math.cos(theta)))*.5
        phi=crown_edge(theta) if upper else (2.40-.05*math.sin(theta))*front+(crown_edge(theta)-.015)*(1-front)
        tangent=(skin(phi+.0001,theta)-skin(phi-.0001,theta)).normalized()
        if not upper:tangent=-tangent
        vertices.append(tuple(skin(phi,theta)+tangent*.012-skin_normal(phi,theta)*(.5*thickness)))
    for j in range(segments):
        a=last+j;b=last+(j+1)%segments
        faces.append((a,b,bridge+(j+1)%segments,bridge+j))
        faces.append((bridge+j,bridge+(j+1)%segments,b+size,a+size))
    obj=finish(name,vertices,faces,material,parent)
    obj['metodo']='Campo superficial continuo; dorso envolvente y borde de radio real'
    obj['outer_face_count']=rings*segments
    return obj


def inset(name,theta_start,theta_end,phi_start,phi_end,material,parent,segments=100,cross=12):
    vertices=[];faces=[]
    for layer in (0,1):
        for i in range(segments):
            t=i/(segments-1);theta=theta_start+(theta_end-theta_start)*t
            taper=.08+.92*math.sin(math.pi*t)**.7
            lo=phi_start(theta);hi=phi_end(theta)
            # Los extremos entran bajo el borde superior. Reducir sólo anchura
            # dejaría una lengüeta suspendida por debajo del labio de la carcasa.
            center=lo+(hi-lo)*.5*math.sin(math.pi*t)**.8;half=(hi-lo)*.5*taper
            for j in range(cross+1):
                phi=center-half+2*half*j/cross
                offset=(-.065+.090*math.sin(math.pi*t)**2) if layer==0 else -.09
                vertices.append(tuple(skin(phi,theta)+skin_normal(phi,theta)*offset))
    stride=cross+1;size=segments*stride
    for layer in (0,1):
        for i in range(segments-1):
            for j in range(cross):
                a=layer*size+i*stride+j;faces.append((a,a+1,a+stride+1,a+stride))
    for i in range(segments-1):
        for j in (0,cross):
            a=i*stride+j;faces.append((a,a+stride,a+stride+size,a+size))
    for i in (0,segments-1):
        for j in range(cross):
            a=i*stride+j;faces.append((a,a+1,a+1+size,a+size))
    return finish(name,vertices,faces,material,parent)


def sample(values,t):
    raw=t*(len(values)-1);index=min(int(raw),len(values)-2);u=raw-index
    def get(i):return values[max(0,min(len(values)-1,i))]
    a,b,c,d=(get(index+i) for i in (-1,0,1,2))
    return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)


def petal(name,controls,widths,depths,material,parent,edge_material=None,segments=176,cross=24):
    points=[Vector(point) for point in controls];vertices=[];faces=[];previous=None
    for i in range(segments):
        t=i/(segments-1);center=sample(points,t)
        tangent=(sample(points,min(1,t+.0001))-sample(points,max(0,t-.0001))).normalized()
        radial=Vector((center.x/.99**2,center.y/.75**2,center.z/.99**2)).normalized()
        normal=(radial-tangent*radial.dot(tangent)).normalized()
        side=tangent.cross(normal).normalized()
        if previous and side.dot(previous)<0:side=-side;normal=-normal
        previous=side
        width=max(.003,sample(widths,t));depth=max(.003,sample(depths,t))
        for j in range(cross):
            angle=2*math.pi*j/cross
            p=center+side*(width*.5*math.cos(angle))+normal*(depth*.5*math.sin(angle))
            vertices.append(tuple(p))
    for i in range(segments-1):
        for j in range(cross):
            a=i*cross+j;b=i*cross+(j+1)%cross;faces.append((a,b,b+cross,a+cross))
    for end in (0,segments-1):
        pole=len(vertices);vertices.append(tuple(sample(points,end/(segments-1))))
        for j in range(cross):faces.append((pole,end*cross+j,end*cross+(j+1)%cross))
    obj=finish(name,vertices,faces,material,parent)
    if edge_material:
        obj.data.materials.append(edge_material)
        for face in obj.data.polygons:
            # Un filete fino en los cantos longitudinales, nunca toda la cara.
            if face.index<(segments-1)*cross and face.index%cross in (0,cross//2):face.material_index=1
    obj['metodo']='Lámina volumétrica abierta en recorrido, con sección elíptica variable y extremos internos'
    obj['terminaciones']='Ambos extremos quedan dentro de la carcasa; no hay cinta suspendida'
    obj['section_count']=segments;obj['section_vertices']=cross
    return obj
