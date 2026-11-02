const express = require('express');
const router = express.Router();
const docController = require('../controllers/document.controller');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authMiddleware);

// Accept any number of PDFs under the field name "files"
const handleUpload = (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      console.error('[Multer Error]', { message: err.message, code: err.code, field: err.field });
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 20}MB.` });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected field. Use field name "files" for uploads.' });
      }
      if (err.message && err.message.includes('Only PDF files are allowed')) {
        return res.status(400).json({ error: 'Only PDF files are accepted.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    next();
  });
};

router.post(
  '/upload',
  handleUpload,
  docController.uploadDocuments
);

router.get('/', docController.getDocuments);
router.get('/:id', docController.getDocument);
router.put('/:id/data', docController.updateDocumentData);
router.delete('/:id', docController.deleteDocument);
router.get('/:id/download', docController.downloadDocument);
router.get('/:id/original', docController.downloadOriginalDocument);

module.exports = router;

