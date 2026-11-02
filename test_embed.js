const path = require('path');
const fs = require('fs');
const { extractContractDataFromPDF } = require('./src/services/extractor.service');
const { generateQRCode, embedQRInPDF } = require('./src/services/pdf.service');

const files = [
  'E:/Projects/QRcode2/newProject/6880795200.pdf',
  'E:/Projects/QRcode2/newProject/اسامه بن سعيد بن عبدالله بن سليمان الصالحي.pdf',
];

(async () => {
  for (const f of files) {
    console.log('='.repeat(90));
    console.log('FILE:', path.basename(f));
    const ext = await extractContractDataFromPDF(f);
    console.log('qrPlacement:', JSON.stringify(ext.qrPlacement));
    const token = 'test_' + Date.now();
    const qrPath = await generateQRCode('https://test.com/pdf/' + token, token);
    const out = await embedQRInPDF(f, qrPath, { ...ext.qrPlacement, outputFilename: 'test_out_' + path.basename(f) });
    console.log('OUT:', out);
    // check position
    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.load(fs.readFileSync(out));
    const page = pdfDoc.getPage(0);
    console.log('page size:', page.getSize());
  }
})();
