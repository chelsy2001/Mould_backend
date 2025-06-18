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
  FROM [PPMS_Solution].[dbo].[Mould_Execute_HCCheckPoint] H
  JOIN 
    [PPMS_Solution].[dbo].[Config_Mould_HCChecklist] c
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

module.exports = router;