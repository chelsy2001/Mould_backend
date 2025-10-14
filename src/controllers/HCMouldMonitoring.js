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
router.get("/HCChecklist", (request, response) => {
  new sqlConnection.sql.Request().query(
    `
  SELECT 
    sch.UID,
    sch.CheckListID,
    chk.CheckListName,
    sch.EquipmentID,
    sch.MouldID,
    mould.MouldName,
    sch.HCFreqCount,
    sch.HCFreqDays,
    sch.HCWarningCount,
    sch.HCWarningDays,
    sch.MaterialID,
    sch.Instance,
    sch.HCStatus,
    sch.LastUpdatedTime,
    sch.LastUpdatedBy
FROM 
    Config_Mould_HCSchedule AS sch
LEFT JOIN 
    Config_Mould_HCCheckList AS chk
    ON sch.CheckListID = chk.CheckListID
LEFT JOIN 
    Config_Mould AS mould
    ON sch.MouldID = mould.MouldID
    ORDER BY 
    CASE 
        WHEN sch.HCStatus IN (4) THEN 0  -- Pin rows with ItemID 3 to the top
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

router.post("/upload-image-to-checklist/:checklistID", upload.single("image"), async (req, res) => {
  const { checklistID } = req.params;
  const file = req.file;

  if (!file) {
    return middlewares.standardResponse(res, null, 400, "❌ No image file uploaded.");
  }

  try {
    const uploadDir = path.join(__dirname, "../uploads/HCCheckList");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").slice(0, 19);
    const fileName = `Checklist${checklistID}_${timestamp}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const pool = await sqlConnection.sql.connect();

    // ✅ Create a request object BEFORE using it
    const selectRequest = pool.request();
    selectRequest.input("ChecklistID", sqlConnection.sql.Int, checklistID);

    const result = await selectRequest.query(`
      SELECT MouldID FROM [dbo].[Config_Mould_HCCheckList]
      WHERE CheckListID = @ChecklistID
    `);

    if (!result.recordset.length) {
      return middlewares.standardResponse(res, null, 404, "❌ ChecklistID not found.");
    }

    const mouldID = result.recordset[0].MouldID;

    // ✅ New request for insert
    const insertRequest = pool.request();
    insertRequest.input("ChecklistID", sqlConnection.sql.Int, checklistID);
    insertRequest.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
    insertRequest.input("Timestamp", sqlConnection.sql.DateTime, new Date());

    await insertRequest.query(`
      INSERT INTO [dbo].[Mould_Checklist_Images] (ChecklistID, Image, Timestamp)
      VALUES (@ChecklistID, @Image, @Timestamp)
    `);

    middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved successfully.");

  } catch (error) {
    console.error("❌ Upload error:", error);
    middlewares.standardResponse(res, null, 500, "❌ Failed to upload image.");
  }
});

module.exports = router;