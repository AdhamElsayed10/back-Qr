const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtDateLtr(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function loadPdfBuffer(doc) {
  const filePath = doc.processedFilePath || doc.originalFilePath;
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  if (doc.contractData) {
    try {
      const parsed = JSON.parse(doc.contractData);
      if (parsed && parsed._pdfBase64) {
        return Buffer.from(parsed._pdfBase64, 'base64');
      }
    } catch (_) {}
  }
  return null;
}

async function findDocument(req, res) {
  const doc = await prisma.document.findUnique({
    where: { qrToken: req.params.token },
  });

  if (!doc) {
    if (req.query.format === 'json' || req.headers['accept']?.includes('application/json')) {
      res.status(404).json({ error: 'Document not found' });
    } else {
      res.status(404).type('html').send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المستند غير موجود</title>
<style>body{font-family:"Cairo",Tahoma,Arial,sans-serif;text-align:center;padding:40px;background:#fff;color:#0f172a;}a{color:#059669;text-decoration:none;}</style>
</head><body><h2>المستند غير موجود</h2><p>رابط التحقق من الـ QR غير صالح أو غير متاح.</p><p><a href="/">العودة للرئيسية</a></p></body></html>`);
    }
    return null;
  }

  return doc;
}

// GET /pdf/:token/file - opens the processed PDF inline or downloads it
router.get('/:token/file', async (req, res) => {
  try {
    const doc = await findDocument(req, res);
    if (!doc) return;

    const encodedTitle = encodeURIComponent(doc.title || 'Contract');
    const disposition = req.query.download ? 'attachment' : 'inline';

    const filePath = doc.processedFilePath || doc.originalFilePath;
    if (filePath && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodedTitle}.pdf"; filename*=UTF-8''${encodedTitle}.pdf`);
      return fs.createReadStream(filePath).pipe(res);
    }

    const buffer = loadPdfBuffer(doc);
    if (buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodedTitle}.pdf"; filename*=UTF-8''${encodedTitle}.pdf`);
      return res.send(buffer);
    }

    return res.status(404).send('PDF file not found on disk');
  } catch (err) {
    console.error('[Public Route] File stream error:', err);
    res.status(500).send('Server error');
  }
});

// GET /pdf/:token/page/:n - renders one PDF page as PNG for the viewer
const pageCache = new Map();
const PAGE_CACHE_LIMIT = 30;

router.get('/:token/page/:n', async (req, res) => {
  try {
    const doc = await findDocument(req, res);
    if (!doc) return;

    const pageNumber = Math.max(1, parseInt(req.params.n, 10) || 1);
    const sourcePath = doc.processedFilePath || doc.originalFilePath;
    const stamp = sourcePath && fs.existsSync(sourcePath) ? fs.statSync(sourcePath).mtimeMs : 'embedded';
    const cacheKey = `${req.params.token}:${pageNumber}:${stamp}`;
    const cached = pageCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const buffer = loadPdfBuffer(doc);
    if (!buffer) return res.status(404).send('PDF file not found');

    const mupdf = await import('mupdf');
    const pdf = mupdf.Document.openDocument(buffer, 'application/pdf');
    const total = pdf.countPages();
    if (pageNumber > total) return res.status(404).send('Page not found');

    const page = pdf.loadPage(pageNumber - 1);
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
    const png = Buffer.from(pixmap.asPNG());
    try { pixmap.destroy(); } catch (_) {}
    try { page.destroy(); } catch (_) {}
    try { pdf.destroy(); } catch (_) {}

    if (pageCache.size >= PAGE_CACHE_LIMIT) {
      const oldest = pageCache.keys().next().value;
      pageCache.delete(oldest);
    }
    pageCache.set(cacheKey, png);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(png);
  } catch (err) {
    console.error('[Public Route] Page render error:', err);
    res.status(500).send('Server error');
  }
});

// GET /pdf/:token/data - JSON API endpoint for inspection of extracted contract data
router.get('/:token/data', async (req, res) => {
  try {
    const doc = await findDocument(req, res);
    if (!doc) return;

    let contractData = null;
    try {
      if (doc.contractData) contractData = JSON.parse(doc.contractData);
    } catch (_) {}

    res.json({
      success: true,
      id: doc.id,
      title: doc.title,
      qrUrl: doc.qrUrl,
      isDataFilled: Boolean(doc.isDataFilled),
      processingStatus: doc.processingStatus,
      contractData,
      uploadDate: doc.uploadDate,
    });
  } catch (err) {
    console.error('[Public Route] Error returning json:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PAGE_STYLE = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#ffffff;color:#0f172a;font-family:"Cairo",Tahoma,Arial,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.verified-strip{width:100%;background:linear-gradient(135deg,#059669 0%,#047857 100%);color:#ffffff;padding:14px 18px;box-shadow:0 2px 10px rgba(5,150,105,.18)}
.verified-strip-inner{max-width:920px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;text-align:center}
.verified-badge-pill{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.42);padding:4px 13px;border-radius:999px;font-size:13.5px;font-weight:800;letter-spacing:.5px;direction:ltr}
.verified-badge-icon{width:20px;height:20px;background:#ffffff;color:#059669;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.verified-title{font-size:16px;font-weight:800;color:#ffffff}
.page-wrap{max-width:920px;margin:0 auto;padding:18px 14px 40px;background:#ffffff}
.expiry-section{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px 10px 4px;text-align:center}
.expiry-row{display:inline-flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:15.5px;font-weight:700;color:#1e293b}
.expiry-date-value{display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:3px 14px;border-radius:8px;font-weight:800;font-size:16px;direction:ltr;letter-spacing:.4px}
.issue-sub{font-size:12.5px;color:#64748b;font-weight:600}
.section-divider{border:0;height:1px;background:#e2e8f0;margin:14px 0;width:100%}
.validity-alert{display:flex;align-items:center;justify-content:center;gap:10px;background:#fffbeb;border:1px solid #fde68a;border-right:4px solid #d97706;border-radius:10px;padding:11px 16px;color:#92400e;font-size:14px;font-weight:700;margin-bottom:18px;text-align:right}
.validity-alert svg{flex-shrink:0;color:#d97706}
.viewer-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 20px rgba(15,23,42,.05);overflow:hidden}
.viewer-toolbar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.viewer-doc-name{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:#334155;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.viewer-actions{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.zoom-btn{background:#ffffff;border:1px solid #cbd5e1;color:#334155;border-radius:7px;padding:4px 10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.zoom-btn:hover{background:#f1f5f9}
.dl-btn{display:inline-flex;align-items:center;gap:6px;background:#059669;color:#ffffff;text-decoration:none;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:700}
.dl-btn:hover{background:#047857}
.viewer-stage{background:#ffffff;padding:14px 8px 20px;display:flex;flex-direction:column;align-items:center;overflow-x:auto}
.pages-wrap{width:100%;display:flex;flex-direction:column;align-items:center}
.doc-page-img{display:block;width:100%;max-width:860px;height:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 2px 12px rgba(15,23,42,.06);margin-bottom:14px;transition:width .15s ease}
`;

const ZOOM_SCRIPT = `
(function(){
  var stage=document.getElementById("viewerStage");
  var zoomResetBtn=document.getElementById("zoomResetBtn");
  var imgs=document.querySelectorAll(".doc-page-img");
  var zoomFactor=1.0;
  function applyZoom(){
    var bw=Math.min((stage?stage.clientWidth:window.innerWidth)-18,860);
    if(bw<260)bw=280;
    var px=Math.round(bw*zoomFactor);
    for(var i=0;i<imgs.length;i++){
      if(zoomFactor===1.0){imgs[i].style.width="100%";imgs[i].style.maxWidth="860px";}
      else{imgs[i].style.width=px+"px";imgs[i].style.maxWidth="none";}
    }
    if(zoomResetBtn)zoomResetBtn.textContent=Math.round(zoomFactor*100)+"%";
  }
  document.getElementById("zoomInBtn").addEventListener("click",function(){zoomFactor=Math.min(2.2,Math.round((zoomFactor+0.2)*100)/100);applyZoom();});
  document.getElementById("zoomOutBtn").addEventListener("click",function(){zoomFactor=Math.max(0.6,Math.round((zoomFactor-0.2)*100)/100);applyZoom();});
  zoomResetBtn.addEventListener("click",function(){zoomFactor=1.0;applyZoom();});
})();
`;

const CHECK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const CALENDAR_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
const ALERT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
const FILE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
const DOWNLOAD_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

function renderVerificationPage({ token, docTitle, expiry, issued, downloadUrl, filled }) {
  const badge = filled ? 'VERIFIED' : 'RECORDED';
  const subtitle = filled ? 'وثيقة إفادة معتمدة وموثّقة رسمياً' : 'وثيقة مرفوعة للتحقق';
  const safeTitle = escapeHtml(docTitle);

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0,user-scalable=yes"><title>${safeTitle} - التحقق الرسمي</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&display=swap" rel="stylesheet"><style>${PAGE_STYLE}</style></head><body><header class="verified-strip"><div class="verified-strip-inner"><span class="verified-badge-pill"><span class="verified-badge-icon">${CHECK_ICON}</span><span>${badge}</span></span><span class="verified-title">${subtitle}</span></div></header><main class="page-wrap"><section class="expiry-section"><div class="expiry-row">${CALENDAR_ICON}<span>تاريخ انتهاء الصلاحية (Expiry Date):</span><span class="expiry-date-value">${escapeHtml(expiry)}</span></div><div class="issue-sub">تاريخ إصدار الإفادة: <span dir="ltr">${escapeHtml(issued)}</span></div></section><hr class="section-divider"><div class="validity-alert" role="alert">${ALERT_ICON}<span>تنبيه: صلاحية هذه الإفادة 30 يوماً فقط من تاريخ الإصدار.</span></div><section class="viewer-card"><div class="viewer-toolbar"><div class="viewer-doc-name" title="${safeTitle}">${FILE_ICON}<span>${safeTitle}</span></div><div class="viewer-actions"><button type="button" class="zoom-btn" id="zoomOutBtn" title="تصغير">−</button><button type="button" class="zoom-btn" id="zoomResetBtn" title="الحجم الطبيعي">100%</button><button type="button" class="zoom-btn" id="zoomInBtn" title="تكبير">+</button><a class="dl-btn" href="${downloadUrl}" download="${safeTitle}">${DOWNLOAD_ICON}<span>تحميل PDF</span></a></div></div><div class="viewer-stage" id="viewerStage"><div class="pages-wrap" id="pagesWrap"><img class="doc-page-img" src="/pdf/${encodeURIComponent(token)}/page/1" alt="${safeTitle} - صفحة 1" decoding="async"></div></div></section></main><script>${ZOOM_SCRIPT}</script></body></html>`;
}

// GET /pdf/:token - public verification page opened by scanning the QR code
router.get('/:token', async (req, res) => {
  try {
    const doc = await findDocument(req, res);
    if (!doc) return;

    if (req.query.format === 'json' || req.headers['accept']?.includes('application/json')) {
      let contractData = null;
      try {
        if (doc.contractData) contractData = JSON.parse(doc.contractData);
      } catch (_) {}

      return res.json({
        success: true,
        id: doc.id,
        title: doc.title,
        qrUrl: doc.qrUrl,
        isDataFilled: Boolean(doc.isDataFilled),
        processingStatus: doc.processingStatus,
        contractData,
        uploadDate: doc.uploadDate,
      });
    }

    const isDataFilled = Boolean(doc.isDataFilled);
    let contractData = null;
    try {
      if (doc.contractData) contractData = JSON.parse(doc.contractData);
    } catch (e) {
      console.error('[Public Route] Failed to parse contract data:', e);
    }

    const docTitle = doc.title || 'المستند';
    const downloadUrl = `/pdf/${encodeURIComponent(req.params.token)}/file?download=1`;
    const contract = contractData && contractData.contractDetails ? contractData.contractDetails : {};

    const expiry = contract.endDate ? fmtDateLtr(contract.endDate) : '—';
    const issued = fmtDateLtr(doc.uploadDate);

    return res.type('html').send(renderVerificationPage({
      token: req.params.token,
      docTitle,
      expiry,
      issued,
      downloadUrl,
      filled: isDataFilled,
    }));
  } catch (err) {
    console.error('[Public Route] Error rendering page:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
