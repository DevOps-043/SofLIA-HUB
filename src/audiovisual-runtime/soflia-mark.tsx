import geometry from '../../resources/audiovisual/soflia-logo-geometry.json';
/** Geometría medida del activo entregado; no sustituirlo por un icono genérico. */
export function SofliaMark() {
  const colors = { navy: '#082943', teal: '#16C1AD' };
  return <svg viewBox="38 127 773 961" role="img" aria-label="Símbolo SofLIA">
    {geometry.links.map((link, i) => {
      const a = geometry.nodes[link.a], b = geometry.nodes[link.b], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx,dy);
      const ox = -dy / length * link.offset, oy = dx / length * link.offset;
      return <line key={i} x1={a.x+ox} y1={a.y+oy} x2={b.x+ox} y2={b.y+oy} stroke={colors[link.color as keyof typeof colors]} strokeWidth={link.width} />;
    })}
    {geometry.nodes.map((node, i) => <circle key={i} cx={node.x} cy={node.y} r={node.r} fill={colors[node.color as keyof typeof colors]} />)}
  </svg>;
}
