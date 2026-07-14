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

router.get('/GetExecuteCheckPoints/:CheckListID/:MouldID', (request, response) => {

  const { CheckListID, MouldID } = request.params;

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
        p.[MouldID],
        c.[CheckListName]
    FROM 
        Mould_Execute_PMCheckPoint p
    INNER JOIN 
        Config_Mould_PMCheckList c
        ON p.CheckListID = c.CheckListID
    WHERE 
        p.CheckListID = @CheckListID
        AND p.MouldID = @MouldID
        AND p.CheckListType = 2;
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('CheckListID', sqlConnection.sql.Int, CheckListID);
  sqlRequest.input('MouldID', sqlConnection.sql.NVarChar(50), MouldID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      return middlewares.standardResponse(
        response,
        null,
        500,
        'Error executing query: ' + err.message
      );
    }

    return middlewares.standardResponse(
      response,
      result.recordset,
      200,
      'Success'
    );
  });
});

//Update API to update the OKNOK and obeservation

router.post('/ExecuteUpdateCheckPointStatus', async (req, res) => {
  const { CheckPointID, UID, MouldID, Observation, OKNOK, UpperLimit, LowerLimit } = req.body;

  if ((!CheckPointID && !UID) || OKNOK === undefined) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields. Provide CheckPointID or UID, and OKNOK.");
  }

  try {
    let resolvedMouldID = MouldID;

    if (!resolvedMouldID) {
      const idRequest = new sqlConnection.sql.Request();
      let idQuery;

      if (UID) {
        idQuery = `SELECT MouldID FROM Mould_Execute_PMCheckPoint WHERE UID = @UID`;
        idRequest.input('UID', sql.Int, UID);
      } else {
        idQuery = `SELECT MouldID FROM Mould_Execute_PMCheckPoint WHERE CheckPointID = @CheckPointID`;
        idRequest.input('CheckPointID', sql.Int, CheckPointID);
      }

      const idResult = await idRequest.query(idQuery);
      if (idResult.recordset.length === 0) {
        return middlewares.standardResponse(res, null, 404, "Unable to resolve MouldID from CheckPointID/UID.");
      }
      if (!UID && idResult.recordset.length > 1) {
        return middlewares.standardResponse(res, null, 400, "Multiple matching checkpoints found. Send MouldID or UID.");
      }

      resolvedMouldID = idResult.recordset[0].MouldID;
    }

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
        CheckPointID = @CheckPointID and MouldID = @MouldID
    `;

    sqlRequest.input('Observation', sql.NVarChar, Observation ?? '');
    sqlRequest.input('OKNOK', sql.Int, OKNOK);

    // ✅ Allow NULL values
    sqlRequest.input('UpperLimit', sql.Numeric(10, 2), upper);
    sqlRequest.input('LowerLimit', sql.Numeric(10, 2), lower);

    sqlRequest.input('CheckPointID', sql.Int, CheckPointID);
    sqlRequest.input('MouldID', sql.NVarChar(50), resolvedMouldID);

    await sqlRequest.query(query);

    middlewares.standardResponse(res, null, 200, "CheckPoint status updated successfully.");
  } catch (err) {
    middlewares.standardResponse(res, null, 500, "Database error: " + err.message);
  }
});

router.post('/SubmitPMChecklist', async (req, res) => {
  const { CheckListID, MouldID } = req.body;

  if (!CheckListID || !MouldID) {
    return middlewares.standardResponse(
      res,
      null,
      400,
      "Missing CheckListID or MouldID"
    );
  }

  try {
    // 1. Validate Checklist exists for selected Mould
    const checklistResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT TOP 1 *
        FROM Mould_Execute_PMCheckList
        WHERE CheckListID = @CheckListID
          AND MouldID = @MouldID
      `);

    if (checklistResult.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        404,
        "Checklist not found for selected Mould."
      );
    }

    // 2. Check Pending Checkpoints
    const nullCountResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT COUNT(*) AS NullCount
        FROM Mould_Execute_PMCheckPoint
        WHERE CheckListID = @CheckListID
          AND MouldID = @MouldID
          AND CheckListType = 2
          AND OKNOK IS NULL
      `);

    if (nullCountResult.recordset[0].NullCount > 0) {
      return middlewares.standardResponse(
        res,
        null,
        400,
        "Please execute all the checkpoints."
      );
    }

    // 3. Check NOK
    const nokCountResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT COUNT(*) AS NOKCount
        FROM Mould_Execute_PMCheckPoint
        WHERE CheckListID = @CheckListID
          AND MouldID = @MouldID
          AND CheckListType = 2
          AND OKNOK = 2
      `);

    if (nokCountResult.recordset[0].NOKCount > 0) {
      return middlewares.standardResponse(
        res,
        null,
        400,
        "Please check NOK checkpoint."
      );
    }

    // 4. Update Checklist Status
    await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        UPDATE Mould_Execute_PMCheckList
        SET PMStatus = 6
        WHERE CheckListID = @CheckListID
          AND MouldID = @MouldID
      `);

    // 5. Update PM Schedule
    await new sqlConnection.sql.Request()
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        UPDATE Config_Mould_PMSchedule
        SET PMStatus = 6
        WHERE MouldID = @MouldID
      `);

    // 6. Update Monitoring
    await new sqlConnection.sql.Request()
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        UPDATE Mould_Monitoring
        SET MouldPMStatus = 6
        WHERE MouldID = @MouldID
      `);

    // 7. Get Current Mould Life
    const lifeResult = await new sqlConnection.sql.Request()
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT MouldActualLife
        FROM Mould_Monitoring
        WHERE MouldID = @MouldID
      `);

    const ActualLife = lifeResult.recordset[0]?.MouldActualLife || 0;

    // 8. Insert Genealogy
    await new sqlConnection.sql.Request()
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .input('ActualLife', sqlConnection.sql.Int, ActualLife)
      .query(`
        INSERT INTO Mould_Genealogy
        (
            MouldID,
            CurrentMouldLife,
            ParameterID,
            ParameterValue,
            [Timestamp]
        )
        VALUES
        (
            @MouldID,
            @ActualLife,
            5,
            6,
            GETDATE()
        )
      `);

    return middlewares.standardResponse(
      res,
      null,
      200,
      "PM Checklist submitted successfully."
    );

  } catch (err) {
    console.error(err);

    return middlewares.standardResponse(
      res,
      null,
      500,
      err.message
    );
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