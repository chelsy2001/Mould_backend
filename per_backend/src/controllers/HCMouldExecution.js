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
      ,H.[LastUpdatedTime]
  FROM [PPMS_Solution].[dbo].[Mould_Execute_HCCheckPoint] H
  JOIN 
    [PPMS_Solution].[dbo].[Config_HCCheckList] c
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
      UPDATE [PPMS_Solution].[dbo].[Mould_Execute_HCCheckPoint]
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

module.exports = router;