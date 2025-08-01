// const express = require("express");
// const sqlConnection = require("../databases/ssmsConn.js");
// const middlewares = require("../middlewares/middlewares.js");
// const multer = require("multer");

// const router = express.Router();

// // Store uploaded files in memory as buffer
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // POST API to upload image to Config_Mould table
// router.post("/upload-image/:mouldID", upload.single("image"), async (req, res) => {
//   const { mouldID } = req.params;
//   const file = req.file;

//   if (!file) {
//     return middlewares.standardResponse(res, null, 400, "❌ No image file uploaded.");
//   }

//   try {
//     const pool = await sqlConnection.sql.connect();
//     const request = pool.request();

//     request.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
//     request.input("mouldID", sqlConnection.sql.NVarChar, mouldID);

//     await request.query(`
//      IF EXISTS (SELECT 1 FROM Mould_Images WHERE MouldID = @mouldID)
// BEGIN
//     UPDATE Mould_Images 
//     SET Image = @Image, Timestamp = GETDATE()
//     WHERE MouldID = @mouldID
// END
// ELSE
// BEGIN
//     INSERT INTO Mould_Images (MouldID, Image, Timestamp)
//     VALUES (@mouldID, @Image, GETDATE())
// END
//     `);

//     middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved to database successfully");
//   } catch (error) {
//     console.error("❌ Image upload error:", error);
//     middlewares.standardResponse(res, null, 500, "❌ Failed to upload image");
//   }
// });

// module.exports = router;

const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Store uploaded files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// API to upload image to DB and folder
router.post("/upload-image/:mouldID", upload.single("image"), async (req, res) => {
  const { mouldID } = req.params;
  const file = req.file;

  if (!file) {
    return middlewares.standardResponse(res, null, 400, "❌ No image file uploaded.");
  }

  try {
    const pool = await sqlConnection.sql.connect();
    const request = pool.request();

    request.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
    request.input("mouldID", sqlConnection.sql.NVarChar, mouldID);

    // Save to DB
    await request.query(`
      INSERT INTO Mould_Images (MouldID, Image, Timestamp)
      VALUES (@mouldID, @Image, GETDATE())
    `);

    // Format timestamp for filename
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").slice(0, 19);

    // Create upload directory if not exists
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // File path: uploads/MouldID_yyyy_mm_dd_hh_mm_ss.jpg
    const fileName = `${mouldID}_${timestamp}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    // Save image to folder
    fs.writeFileSync(filePath, file.buffer);

    middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved to DB and folder.");
  } catch (error) {
    console.error("❌ Upload error:", error);
    middlewares.standardResponse(res, null, 500, "❌ Failed to upload image.");
  }
});

module.exports = router;
