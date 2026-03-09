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

router.get('/GetCheckPoints/:CheckListID', (request, response) => {
  const CheckListID = request.params.CheckListID;

  const query = `
    SELECT 
    p.[UID],
    p.[CheckListID],
    p.[CheckPointID],
    p.[CheckPointName],
    p.[CheckArea],
    p.[CheckPointItems],
    p.[CheckPointArea],
    p.[CheckingMethod],
    p.[JudgementCriteria],
    p.[CheckListType],
    p.[CheckPointType],
    p.[UOM],
    p.[UpperLimit],
    p.[LowerLimit],
    p.[Standard],
    p.[CheckPointValue],
    p.[OKNOK],
    p.[Observation],
    p.[LastUpdatedTime],
    c.[CheckListName]
FROM 
    Mould_Execute_PMCheckPoint p
JOIN 
    Config_Mould_PMCheckList c
    ON p.CheckListID = c.CheckListID
WHERE 
    p.CheckListID = @CheckListID  AND 
    p.CheckListType = 1;
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('CheckListID', sqlConnection.sql.Int, CheckListID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(response, null, 300, 'Error executing query: ' + err);
    } else {
      middlewares.standardResponse(response, result.recordset, 200, 'Success');
    }
  });
});

// update api to update the Checkpointsn observation
router.post('/UpdateCheckPointStatus', async (req, res) => {
  const { CheckPointID, Observation, OKNOK } = req.body;

  if (!CheckPointID || OKNOK === undefined) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields.");
  }

  try {
    const query = `
      UPDATE Mould_Execute_PMCheckPoint
      SET 
        Observation = @Observation,
        OKNOK = @OKNOK,
        LastUpdatedTime = GETDATE()
      WHERE 
        CheckPointID = @CheckPointID
    `;

    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input('Observation', sql.NVarChar, Observation ?? '');
    sqlRequest.input('OKNOK', sql.Int, OKNOK); // 1 for OK, 2 for NOK
    sqlRequest.input('CheckPointID', sql.Int, CheckPointID);

    await sqlRequest.query(query);

    middlewares.standardResponse(res, null, 200, "CheckPoint status updated successfully.");
  } catch (err) {
    middlewares.standardResponse(res, null, 500, "Database error: " + err.message);
  }
});
//----SUbmit button API to change the status 

// POST: Submit PM Preparation Completion
router.post('/SubmitPreparation', async (req, res) => {
  const { CheckListID } = req.body;

  if (!CheckListID) {
    return middlewares.standardResponse(res, null, 400, "CheckListID is required.");
  }

  try {
    const sqlRequest = new sqlConnection.sql.Request();

    // Count NULL OKNOK entries
    const countNullResult = await sqlRequest.query(`
      SELECT COUNT(*) as NullCount 
      FROM Mould_Execute_PMCheckPoint
      WHERE OKNOK IS NULL AND CheckListID = ${CheckListID} AND CheckListType = 1
    `);

    const nullCount = countNullResult.recordset[0].NullCount;

    // Count NOK entries
    const countNokResult = await sqlRequest.query(`
      SELECT COUNT(*) as NokCount 
      FROM Mould_Execute_PMCheckPoint 
      WHERE OKNOK = 2 AND CheckListID = ${CheckListID} AND CheckListType = 1
    `);

    const nokCount = countNokResult.recordset[0].NokCount;

    if (nullCount === 0 && nokCount === 0) {
      // Fetch MouldID
      const mouldResult = await sqlRequest.query(`
        SELECT MouldID 
        FROM Mould_Execute_PMCheckList 
        WHERE CheckListID = ${CheckListID}
      `);

      if (mouldResult.recordset.length === 0) {
        return middlewares.standardResponse(res, null, 404, "MouldID not found.");
      }

      const MouldID = mouldResult.recordset[0].MouldID;

      // Call stored procedure
      const execRequest = new sqlConnection.sql.Request();
      execRequest.input('MouldID', sqlConnection.sql.NVarChar, MouldID);

      await execRequest.execute('PM_MainCheckPointMovementToExecutionAfterPrep');

      return middlewares.standardResponse(res, null, 200, "Checkpoint submitted successfully.");
    } else {
      if (nullCount !== 0) {
        return middlewares.standardResponse(res, null, 400, "Please execute all the checkpoints.");
      } else {
        return middlewares.standardResponse(res, null, 400, "Please check NOK checkpoint.");
      }
    }

  } catch (err) {
    return middlewares.standardResponse(res, null, 500, "Server error: " + err.message);
  }
});

router.post(
  "/upload-image-to-checkpoint/:checklistID/:checkpointID/:instance",
  upload.single("image"),
  async (req, res) => {

    const { checklistID, checkpointID, instance } = req.params;
    const file = req.file;

    if (!file) {
      return middlewares.standardResponse(res, null, 400, "No image uploaded.");
    }

    try {

      //----------------------------------
      // 1️⃣ Get MouldID
      //----------------------------------

      const pool = await sqlConnection.sql.connect();

      const mouldResult = await pool.request()
        .input("CheckListID", sql.Int, checklistID)
        .query(`
          SELECT MouldID
          FROM Mould_Execute_PMCheckList
          WHERE CheckListID = @CheckListID
        `);

      if (mouldResult.recordset.length === 0) {
        return middlewares.standardResponse(res, null, 404, "Checklist not found.");
      }

      const mouldID = mouldResult.recordset[0].MouldID;

      //----------------------------------
      // 2️⃣ Instance + 1
      //----------------------------------

      const newInstance = parseInt(instance) + 1;

      //----------------------------------
      // 3️⃣ Image Name
      //----------------------------------

      const imageName = `${mouldID}_${checkpointID}_${newInstance}.jpg`;

      //----------------------------------
      // 4️⃣ Save Image in Folder
      //----------------------------------

      const uploadDir = path.join(__dirname, "../uploads/PMcheckpoints");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, imageName);

      fs.writeFileSync(filePath, file.buffer);

      //----------------------------------
      // 5️⃣ Save in DB
      //----------------------------------

      await pool.request()
        .input("ChecklistID", sql.Int, checklistID)
        .input("Checkpoints", sql.NVarChar, checkpointID)
        .input("Image", sql.VarBinary(sql.MAX), file.buffer)
        .input("Timestamp", sql.DateTime, new Date())
        .input("ImageType", sql.NVarChar, "pm")
        .input("MouldID", sql.NVarChar, mouldID)
        .input("Instance", sql.Int, newInstance)
        .query(`
          INSERT INTO Mould_Checklist_Images
          (ChecklistID, Checkpoints, Image, Timestamp, ImageType, MouldID, Instance)
          VALUES
          (@ChecklistID, @Checkpoints, @Image, @Timestamp, @ImageType, @MouldID, @Instance)
        `);

      middlewares.standardResponse(res, null, 200, `Image saved as ${imageName}`);

    } catch (error) {
      console.error("Upload error:", error);
      middlewares.standardResponse(res, null, 500, "Upload failed.");
    }
  }
);

module.exports = router;