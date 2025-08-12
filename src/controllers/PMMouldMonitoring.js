const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");


const multer = require("multer");
const fs = require("fs");
const path = require("path");
const router = express.Router();
// Store uploaded files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });


// Get all Plant
router.get("/PMChecklist", (request, response) => {
  new sqlConnection.sql.Request().query(
    `
  SELECT 
    sch.UID,
    sch.CheckListID,
    chk.CheckListName,
    sch.EquipmentID,
    sch.MouldID,
    mould.MouldName,
    sch.PMFreqCount,
    sch.PMFreqDays,
    sch.PMWarningCount,
    sch.PMWarningDays,
    sch.MaterialID,
    sch.Instance,
    sch.PMStatus,
    sch.LastUpdatedTime,
    sch.LastUpdatedBy
FROM 
    Config_Mould_PMSchedule AS sch
LEFT JOIN 
    Config_Mould_PMCheckList AS chk
    ON sch.CheckListID = chk.CheckListID
LEFT JOIN 
   dbo.Config_Mould AS mould
    ON sch.MouldID = mould.MouldID
	ORDER BY 
    CASE 
        WHEN sch.PMStatus IN (4) THEN 0  -- Pin rows with ItemID 3 to the top
        ELSE 1
    END `,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(response, null, 300, "Error executing query: " + err);
      } else {
        middlewares.standardResponse(response, result.recordset, 200, "success");
      }
    }
  );
});


// router.post("/upload-image-to-checklist/:checklistID", upload.single("image"), async (req, res) => {
//   const { checklistID } = req.params;
//   const file = req.file;

//   if (!file) {
//     return middlewares.standardResponse(res, null, 400, "❌ No image file uploaded.");
//   }

//   try {
//     // Save image to folder
//     const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").slice(0, 19);
//     const uploadDir = path.join(__dirname, "../uploads/PMchecklist");

//     // Ensure the folder exists
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     // File path: uploads/PMcheckpoints/ChecklistID_timestamp.jpg
//     const fileName = `Checklist${checklistID}_${timestamp}.jpg`;
//     const filePath = path.join(uploadDir, fileName);

//     fs.writeFileSync(filePath, file.buffer);

//     // Connect to DB
//     const pool = await sqlConnection.sql.connect();
//     const request = pool.request();

//     // Step 1: Get MouldID from Config_Mould_PMCheckList
//     request.input("ChecklistID", sqlConnection.sql.Int, checklistID);
//     const result = await request.query(`
//       SELECT MouldID FROM [dbo].[Config_Mould_PMCheckList]
//       WHERE CheckListID = @ChecklistID
//     `);

//     if (!result.recordset.length) {
//       return middlewares.standardResponse(res, null, 404, "❌ ChecklistID not found.");
//     }

//     const mouldID = result.recordset[0].MouldID;

//     // Step 2: Insert image into Mould_Images table
//     const insertRequest = pool.request();
//     insertRequest.input("MouldID", sqlConnection.sql.Int, mouldID);
//     insertRequest.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
//     insertRequest.input("Timestamp", sqlConnection.sql.DateTime, new Date());
//     insertRequest.input("ParameterID", sqlConnection.sql.Int, 3);

//     await insertRequest.query(`
//       INSERT INTO [dbo].[Mould_Images] (MouldID, Image, Timestamp, ParameterID)
//       VALUES (@MouldID, @Image, @Timestamp, @ParameterID)
//     `);

//     middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved to folder and database.");
//   } catch (error) {
//     console.error("❌ Upload error:", error);
//     middlewares.standardResponse(res, null, 500, "❌ Failed to upload image.");
//   }
// });
module.exports = router;