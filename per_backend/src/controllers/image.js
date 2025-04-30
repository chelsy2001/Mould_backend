const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");
const multer = require("multer");

const router = express.Router();

// Store uploaded files in memory as buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST API to upload image to Config_Mould table
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

    await request.query(`
      UPDATE [PPMS_Solution].[dbo].[Mould_Images] 
      SET MouldImage = @Image, Timestamp = GETDATE()
      WHERE MouldID = @mouldID
    `);

    middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved to database successfully");
  } catch (error) {
    console.error("❌ Image upload error:", error);
    middlewares.standardResponse(res, null, 500, "❌ Failed to upload image");
  }
});

module.exports = router;
