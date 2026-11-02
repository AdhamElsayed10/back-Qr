const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/originals');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Decode originalname from latin1 to UTF-8 (multer encodes non-ASCII filenames as latin1)
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${unique}-${decodedName.replace(/\s+/g, '_')}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '20');

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = upload;
