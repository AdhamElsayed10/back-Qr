const QRCode = require('qrcode');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const qrDir = path.join(__dirname, '../../uploads/qrcodes');
const processedDir = path.join(__dirname, '../../uploads/processed');

if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

/**
 * Generate QR code PNG file from a URL
 */
async function generateQRCode(url, filename) {
  const qrPath = path.join(qrDir, `${filename}.png`);
  await QRCode.toFile(qrPath, url, {
    errorCorrectionLevel: 'H',
    width: 150,
    margin: 1,
  });
  return qrPath;
}

/**
 * Get QR position coordinates
 * position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom'
 * customX, customY: used if position is 'custom' (x = left in page coords, y = bottom-up in pdf-lib coords)
 */
function getQRPosition(position, pageWidth, pageHeight, qrSize = 70, customX, customY) {
  const margin = 25;
  const cx = (customX !== undefined && customX !== null && !Number.isNaN(Number(customX))) ? Number(customX) : null;
  const cy = (customY !== undefined && customY !== null && !Number.isNaN(Number(customY))) ? Number(customY) : null;

  switch (position) {
    case 'top-left':
      return { x: margin, y: pageHeight - qrSize - margin };
    case 'top-right':
      return { x: pageWidth - qrSize - margin, y: pageHeight - qrSize - margin };
    case 'bottom-left':
      return { x: margin, y: margin };
    case 'bottom-right':
      return { x: pageWidth - qrSize - margin, y: margin };
    case 'custom':
      return {
        x: (cx !== null) ? cx : (pageWidth - qrSize - margin),
        y: (cy !== null) ? cy : margin,
      };
    default:
      return { x: pageWidth - qrSize - margin, y: margin };
  }
}

/**
 * Parse page selection string into array of 0-based indices
 */
function parsePageSelection(selection, totalPages) {
  if (selection === 'all') return null;
  if (!selection || selection === 'first' || selection === '1') return [0];
  return selection
    .split(',')
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < totalPages);
}

/**
 * Embed QR code into PDF
 */
async function embedQRInPDF(pdfPath, qrImagePath, options = {}) {
  const {
    position = 'custom',
    pageSelection = 'first',
    customX = 45,
    customY = 635,
    qrSize = 70,
    outputFilename,
  } = options;

  const pdfBytes = fs.readFileSync(pdfPath);
  const qrBytes = fs.readFileSync(qrImagePath);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const qrImage = await pdfDoc.embedPng(qrBytes);

  const pages = pdfDoc.getPages();
  const selectedIndices = parsePageSelection(pageSelection, pages.length);
  const targetPages = selectedIndices ? selectedIndices.map((i) => pages[i]).filter(Boolean) : pages;

  for (const page of targetPages) {
    const { width, height } = page.getSize();
    const { x, y } = getQRPosition(position, width, height, qrSize, customX, customY);
    page.drawImage(qrImage, { x, y, width: qrSize, height: qrSize });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  const outPath = path.join(processedDir, outputFilename || `processed_${Date.now()}.pdf`);
  fs.writeFileSync(outPath, modifiedPdfBytes);
  return outPath;
}

module.exports = { generateQRCode, embedQRInPDF, getQRPosition };
