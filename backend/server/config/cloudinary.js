let cloudinary = require("cloudinary").v2;
let multer = require("multer");
let { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "connectsphere_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "avi", "webm"],
    resource_type: "auto",
  },
});

let upload = multer({ storage });

module.exports = { upload, cloudinary };
