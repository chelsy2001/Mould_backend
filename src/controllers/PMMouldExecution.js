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

router.get('/GetExecuteCheckPoints/:CheckListID', (request, response) => {
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
    p.CheckListType = 2;
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

//Update API to update the OKNOK and obeservation

router.post('/ExecuteUpdateCheckPointStatus', async (req, res) => {
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

router.post('/SubmitPMChecklist', async (req, res) => {
  const { CheckListID } = req.body;

  if (!CheckListID) {
    return middlewares.standardResponse(res, null, 400, "Missing CheckListID");
  }

  try {
    // 1. Check count of NULL OKNOK entries
    const nullCountResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .query(`
        SELECT COUNT(*) AS NullCount 
        FROM Mould_Execute_PMCheckPoint 
        WHERE OKNOK IS NULL AND CheckListID = @CheckListID AND CheckListType = 2
      `);
    const nullCount = nullCountResult.recordset[0].NullCount;

    if (nullCount > 0) {
      return middlewares.standardResponse(res, null, 400, "Please execute all the checkpoints.");
    }

    // 2. Check count of NOK entries
    const nokCountResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .query(`
        SELECT COUNT(*) AS NOKCount 
        FROM Mould_Execute_PMCheckPoint 
        WHERE OKNOK = 2 AND CheckListID = @CheckListID AND CheckListType = 2
      `);
    const nokCount = nokCountResult.recordset[0].NOKCount;

    if (nokCount > 0) {
      return middlewares.standardResponse(res, null, 400, "Please check NOK checkpoint.");
    }

    // 3. Fetch MouldID
    const mouldResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .query(`
        SELECT MouldID 
        FROM Mould_Execute_PMCheckList 
        WHERE CheckListID = @CheckListID
      `);
    const MouldID = mouldResult.recordset[0]?.MouldID;

    if (!MouldID) {
      return middlewares.standardResponse(res, null, 404, "MouldID not found.");
    }

    // 4. Update Config_PMSchedule PMStatus to 6
    await new sqlConnection.sql.Request()
      .query(`
        UPDATE Config_Mould_PMSchedule
        SET PMStatus = 6  WHERE CheckListID = ${CheckListID} And MouldID='${MouldID}'
      `);

    // 5. Update Mould_Execute_PMCheckList PMStatus to 6
    await new sqlConnection.sql.Request()
      .query(`
        UPDATE Mould_Execute_PMCheckList 
        SET PMStatus = 6 
        WHERE CheckListID = ${CheckListID}
      `);

    // 6. Fetch ActualLife from Mould_Monitoring
    const lifeResult = await new sqlConnection.sql.Request()
      .query(`
        SELECT MouldActualLife 
        FROM Mould_Monitoring 
        WHERE MouldID = '${MouldID}'
      `);
    const ActualLife = lifeResult.recordset[0]?.MouldActualLife ?? 0;

    // 7. Insert into Mould_Genealogy
    await new sqlConnection.sql.Request()
      .query(`
        INSERT INTO Mould_Genealogy (MouldID, CurrentMouldLife, ParameterID, ParameterValue, Timestamp)
        VALUES ('${MouldID}', ${ActualLife}, 5, 6, GETDATE())
      `);

    return middlewares.standardResponse(res, null, 200, "PM Checklist submitted successfully.");
  } catch (err) {
    return middlewares.standardResponse(res, null, 500, "Error: " + err.message);
  }
});

router.post(
  "/upload-image-to-checkpoint/:checklistID/:checkpointID",
  upload.single("image"),
  async (req, res) => {
    const { checklistID, checkpointID } = req.params;
    const file = req.file;

    if (!file) {
      return middlewares.standardResponse(res, null, 400, "❌ No image uploaded.");
    }

    try {
      // 1️⃣ Save physical copy in PMcheckpoints folder
      const uploadDir = path.join(__dirname, "../uploads/PMcheckpoints");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").slice(0, 19);
      const fileName = `Checklist${checklistID}_Checkpoint${checkpointID}_${timestamp}.jpg`;
      const filePath = path.join(uploadDir, fileName);

      fs.writeFileSync(filePath, file.buffer);
      console.log(`✅ Image written at: ${filePath}`);

      // 2️⃣ Insert into Mould_Checklist_Images table
      const pool = await sqlConnection.sql.connect();
      const request = pool.request();

      request.input("ChecklistID", sqlConnection.sql.Int, parseInt(checklistID));
      request.input("Checkpoints", sqlConnection.sql.NVarChar(sqlConnection.sql.MAX), checkpointID.toString());
      request.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
      request.input("Timestamp", sqlConnection.sql.DateTime, new Date());

      await request.query(`
        INSERT INTO [dbo].[Mould_Checklist_Images] 
        ([ChecklistID], [Checkpoints], [Image], [Timestamp])
        VALUES (@ChecklistID, @Checkpoints, @Image, @Timestamp)
      `);

      middlewares.standardResponse(res, null, 200, "✅ Image uploaded successfully.");
    } catch (error) {
      console.error("❌ Upload error:", error);
      middlewares.standardResponse(res, null, 500, "❌ Failed to upload image.");
    }
  }
);

module.exports = router;