import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cloudinary from 'cloudinary';

// ─────────────────────────────────────────────
// Storage driver
// ─────────────────────────────────────────────
// Local disk is fine for dev but ephemeral on most hosts — uploads vanish on
// every deploy. Cloudinary (25 GB free, no egress fees) makes uploads durable
// and globally served.
//
//   STORAGE_DRIVER=cloudinary   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
//   STORAGE_DRIVER=disk         (default)
// ─────────────────────────────────────────────

const DRIVER = process.env.STORAGE_DRIVER || 'disk';

if (DRIVER === 'cloudinary') {
  cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Must match the directory Express serves at /uploads — see src/index.js.
const uploadDir = path.join(__dirname, '../../public/uploads');
if (DRIVER === 'disk' && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage — the default, works identically to before.
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Cloudinary storage — uploads to the cloud and returns a public URL.
// Files are stored under careerzen/<fieldname> so they're easy to find.
const cloudinaryStorage = new (await import('multer-storage-cloudinary')).default.CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'careerzen',
    // Preserve the original extension and keep filenames unique.
    public_id: (req, file) => {
      const base = path.parse(file.originalname).name
        .replace(/[^A-Za-z0-9-_]/g, '-').slice(0, 60);
      return `${file.fieldname}-${base}-${Date.now()}`;
    },
  },
});

const storage = DRIVER === 'cloudinary' ? cloudinaryStorage : diskStorage;

// ─────────────────────────────────────────────
// File filters
// ─────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), allowed.includes(file.mimetype));
};

const mediaFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ];
  cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type. Only JPEG, PNG, WebP, GIF images and MP4/WebM/MOV videos are allowed.'), allowed.includes(file.mimetype));
};

const resumeFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ];
  cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type. Only PDF, DOCX, TXT, and images are allowed.'), allowed.includes(file.mimetype));
};

// ─────────────────────────────────────────────
// Multer instances
// ─────────────────────────────────────────────
const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadMedia = multer({ storage, fileFilter: mediaFilter, limits: { fileSize: 50 * 1024 * 1024 } });
const uploadResume = multer({ storage, fileFilter: resumeFilter, limits: { fileSize: 25 * 1024 * 1024 } });

// ─────────────────────────────────────────────
// URL helper
// ─────────────────────────────────────────────
// Pass the whole req.file object. On disk we build /uploads/<filename>;
// on Cloudinary the SDK already wrote the public URL into file.path, so we
// return that directly. Callers must pass req.file, not req.file.filename.
export function getFileUrl(file) {
  if (!file) return null;
  if (DRIVER === 'cloudinary') {
    return file.path || file.secure_url || null;
  }
  return `/uploads/${file.filename}`;
}

// Expose the configured driver so callers can inspect it.
export const storageDriver = DRIVER;

// ─────────────────────────────────────────────
// Export configured multer middleware
// ─────────────────────────────────────────────
export const uploadAvatar = upload.single('avatar');
export const uploadBanner = upload.single('banner');
export const uploadAny = upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);
export const uploadPostMedia = uploadMedia.single('media');
export const uploadCompanyLogo = upload.single('logo');
export const uploadPaymentQr = upload.single('qr');
export const uploadPaymentProof = upload.single('proof');
export const uploadResumeMiddleware = uploadResume.single('resume');

export default upload;