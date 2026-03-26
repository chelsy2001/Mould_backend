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
  const { CheckPointID, Observation, OKNOK, UpperLimit, LowerLimit } = req.body;

  if (!CheckPointID || OKNOK === undefined) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields.");
  }

  try {
    const sqlRequest = new sqlConnection.sql.Request();

    // ✅ Convert values safely
    const upper = UpperLimit === '' || UpperLimit === 0 || UpperLimit === undefined
      ? null
      : parseFloat(UpperLimit);

    const lower = LowerLimit === '' || LowerLimit === 0 || LowerLimit === undefined
      ? null
      : parseFloat(LowerLimit);

    // ❌ If still not valid number → reject
    if ((upper !== null && isNaN(upper)) || (lower !== null && isNaN(lower))) {
      return middlewares.standardResponse(res, null, 400, "UpperLimit/LowerLimit must be valid numbers.");
    }

    const query = `
      UPDATE Mould_Execute_PMCheckPoint
      SET
        Observation = @Observation,
        OKNOK = @OKNOK,
        UpperLimit = @UpperLimit,
        LowerLimit = @LowerLimit,
        LastUpdatedTime = GETDATE()
      WHERE
        CheckPointID = @CheckPointID
    `;

    sqlRequest.input('Observation', sql.NVarChar, Observation ?? '');
    sqlRequest.input('OKNOK', sql.Int, OKNOK);

    // ✅ Allow NULL values
    sqlRequest.input('UpperLimit', sql.Numeric(10, 2), upper);
    sqlRequest.input('LowerLimit', sql.Numeric(10, 2), lower);

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