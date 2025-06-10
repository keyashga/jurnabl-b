import multer from 'multer';

const storage = multer.memoryStorage(); // You can also use diskStorage if preferred

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default upload;
