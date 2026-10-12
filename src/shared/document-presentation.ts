import { DOCUMENT_COLORS, documentHeaderText, resolveDocumentDesign, type DocumentDesign } from './document-design';

/** CSS propio para lectura e impresión; los ajustes públicos son datos validados. */
export function documentReadingStyles(design: DocumentDesign = resolveDocumentDesign()): string {
  return `body{margin:0;background:#fff;color:#${design.body};font:11pt/1.5 "${design.font}",Arial,sans-serif;overflow-wrap:anywhere}
main.document{max-width:720px;margin:0 auto;padding:clamp(24px,5vw,56px)}
h1,h2,h3,h4,h5,h6{color:#${design.heading};font-weight:700;line-height:1.25;break-after:avoid;margin:1.5em 0 .6em}
h1{font-size:18pt}h2{font-size:14pt}h3,h4,h5,h6{font-size:12pt}
h1.document-title{font-size:${design.titleSize / 2}pt;margin:0 0 14px;letter-spacing:-.025em}
.document-subtitle{font-size:13pt;color:#${design.corporate ? DOCUMENT_COLORS.muted : design.heading};margin:0 0 12px}
.document-meta{font-size:9pt;color:#${DOCUMENT_COLORS.muted};margin:0 0 28px}
p{margin:0 0 ${design.paragraphAfter / 20}pt;orphans:3;widows:3}
ul,ol{padding-left:24px;margin:0 0 12px}li{margin:0 0 5px;break-inside:avoid}li>ul,li>ol{margin-top:6px;margin-bottom:0}
table{border-collapse:collapse;table-layout:fixed;width:100%;margin:16px 0 20px;font-size:11pt;line-height:1.35}
thead{display:table-header-group}th,td{border:1px solid #${DOCUMENT_COLORS.border};padding:9px 11px;vertical-align:middle;overflow-wrap:anywhere}
th{background:#${design.tableFill};color:#${documentHeaderText(design.tableFill)};text-align:left;font-weight:700}tbody tr:nth-child(odd){background:#${design.stripe}}
tr{break-inside:avoid}blockquote{margin:16px 0;padding-left:20px}blockquote p{margin-bottom:8px}
pre{white-space:pre-wrap;background:#${DOCUMENT_COLORS.code};padding:12px 16px;font:10pt/1.5 Consolas,monospace;overflow-wrap:anywhere}
code{font:10pt Consolas,monospace}hr{border:0;border-top:1px solid #${DOCUMENT_COLORS.border};margin:20px 0}img{max-width:100%;height:auto}
a{color:inherit;text-decoration:underline}.document-cover{padding-top:120px;padding-bottom:64px}
${design.corporate ? `h1:not(.document-title){border-left:3px solid #${design.accent};padding-left:12px}h2,h3,h4{color:#${design.secondary}}
li::marker{color:#${design.primary}}blockquote{background:#${design.callout};border-left:3px solid #${design.accent};padding:14px 18px;color:#${design.primary}}blockquote p:last-child{margin:0}
.document-cover{text-align:center;padding-top:40px;padding-bottom:40px}.document-logo{display:block;max-width:180px;max-height:120px;object-fit:contain;margin:0 auto 32px}.document-logo img{display:block;max-width:180px;max-height:120px;object-fit:contain;margin:auto}
table.document-metadata{text-align:left;margin-top:36px;font-size:10pt}table.document-metadata td{border:0;padding:10px 12px}table.document-metadata td:first-child{width:30%;font-weight:700;color:#${design.primary}}
.document-running-header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid #${design.accent};padding-bottom:10px;margin-bottom:28px;font-size:9pt;color:#${design.primary}}
.document-running-header img{max-width:88px;max-height:26px;object-fit:contain}.document-running-header span{max-width:75%;text-align:right}
` : ''}
@media print{@page{size:Letter;margin:${design.corporate ? '.85in .75in .75in' : '1in'}}main.document{max-width:none;padding:0}body{font-size:11pt}a{color:inherit}.document-running-header{display:none}.document-cover{padding-top:${design.corporate ? 36 : 90}pt;break-after:page}h1.document-title{font-size:${design.titleSize / 2}pt}}`;
}
