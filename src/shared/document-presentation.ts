import { DOCUMENT_COLORS, documentHeaderText, resolveDocumentDesign, type DocumentDesign } from './document-design';

/** CSS propio para lectura e impresión; los ajustes públicos son datos validados. */
export function documentReadingStyles(design: DocumentDesign = resolveDocumentDesign()): string {
  return `body{margin:0;background:#fff;color:#${DOCUMENT_COLORS.text};font:11pt/1.5 "${design.font}",Arial,sans-serif;overflow-wrap:anywhere}
main.document{max-width:720px;margin:0 auto;padding:clamp(24px,5vw,56px)}
h1,h2,h3,h4,h5,h6{color:#000;font-weight:700;line-height:1.25;break-after:avoid;margin:1.5em 0 .6em}
h1{font-size:18pt}h2{font-size:14pt}h3,h4,h5,h6{font-size:12pt}
h1.document-title{font-size:${design.titleSize / 2}pt;margin:0 0 14px;letter-spacing:-.025em}
.document-subtitle{font-size:13pt;color:#000;margin:0 0 12px}
.document-meta{font-size:9pt;color:#${DOCUMENT_COLORS.muted};margin:0 0 28px}
p{margin:0 0 ${design.paragraphAfter / 20}pt;orphans:3;widows:3}
ul,ol{padding-left:24px;margin:0 0 12px}li{margin:0 0 5px;break-inside:avoid}li>ul,li>ol{margin-top:6px;margin-bottom:0}
table{border-collapse:collapse;table-layout:fixed;width:100%;margin:16px 0 20px;font-size:11pt;line-height:1.35}
thead{display:table-header-group}th,td{border:1px solid #${DOCUMENT_COLORS.border};padding:9px 11px;vertical-align:middle;overflow-wrap:anywhere}
th{background:#${design.accent};color:#${documentHeaderText(design.accent)};text-align:left;font-weight:700}tbody tr:nth-child(odd){background:#${DOCUMENT_COLORS.stripe}}
tr{break-inside:avoid}blockquote{margin:16px 0;padding-left:20px}blockquote p{margin-bottom:8px}
pre{white-space:pre-wrap;background:#${DOCUMENT_COLORS.code};padding:12px 16px;font:10pt/1.5 Consolas,monospace;overflow-wrap:anywhere}
code{font:10pt Consolas,monospace}hr{border:0;border-top:1px solid #${DOCUMENT_COLORS.border};margin:20px 0}img{max-width:100%;height:auto}
a{color:inherit;text-decoration:underline}.document-cover{padding-top:120px;padding-bottom:64px}
@media print{@page{size:Letter;margin:1in}main.document{max-width:none;padding:0}body{font-size:11pt}a{color:inherit}.document-cover{padding-top:90pt;break-after:page}h1.document-title{font-size:${design.titleSize / 2}pt}}`;
}
