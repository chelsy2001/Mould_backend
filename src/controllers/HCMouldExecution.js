const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();


router.get('/GetCheckPoints/:CheckListID', (request, response) => {
  const CheckListID = request.params.CheckListID;

  const query = `
    SELECT 
      H.[CheckListID]
      ,H.[CheckPointID]
      ,H.[CheckPointName]
      ,H.[CheckPointCategory]
      ,H.[StandardCondition]
      ,H.[CheckingMethod]
      ,H.[CheckPointType]
      ,H.[UOM]
      ,H.[UpperLimit]
      ,H.[LowerLimit]
      ,H.[Standard]
      ,H.[CheckPointValue]
      ,H.[OKNOK]
      ,H.[Observation]
      ,H.[LastUpdatedTime],
         c.[CheckListName]
  FROM [PPMS].[dbo].[Mould_Execute_HCCheckPoint] H
  JOIN 
    [PPMS].[dbo].[Config_HCChecklist] c
    ON H.CheckListID = c.CheckListID
WHERE 
    H.CheckListID = @CheckListID
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
      UPDATE [PPMS].[dbo].[Mould_Execute_HCCheckPoint]
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

//Submit Button Functionality


router.post('/SubmitHCChecklist', async (req, res) => {
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
        FROM Mould_Execute_HCCheckPoint 
        WHERE OKNOK IS NULL AND CheckListID = @CheckListID 
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
        FROM Mould_Execute_HCCheckPoint 
        WHERE OKNOK = 2 AND CheckListID = @CheckListID 
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
        FROM Mould_Execute_HCCheckList 
        WHERE CheckListID = @CheckListID
      `);
    const MouldID = mouldResult.recordset[0]?.MouldID;

    if (!MouldID) {
      return middlewares.standardResponse(res, null, 404, "MouldID not found.");
    }

    // 4. Update Config_PMSchedule PMStatus to 6
    await new sqlConnection.sql.Request()
      .query(`
        UPDATE Config_HCSchedule
        SET HCStatus = 5
      `);

    // 5. Update Mould_Execute_PMCheckList PMStatus to 6
    await new sqlConnection.sql.Request()
      .query(`
        UPDATE Mould_Execute_HCCheckList 
        SET HCStatus = 5
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

    return middlewares.standardResponse(res, null, 200, "HC Checklist submitted successfully.");
  } catch (err) {
    return middlewares.standardResponse(res, null, 500, "Error: " + err.message);
  }
});



module.exports = router;