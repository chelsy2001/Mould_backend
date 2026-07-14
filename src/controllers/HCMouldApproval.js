const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();


router.get('/GetCheckPoints/:CheckListID/:MouldID', (request, response) => {
  const { CheckListID: rawCheckListID, MouldID: rawMouldID } = request.params || {};

  let CheckListID = parseInt(rawCheckListID, 10);
  let MouldID = rawMouldID;

   if (Number.isNaN(CheckListID)) {
      // maybe client sent MouldID in first param; try the other param as CheckListID
      const alt = parseInt(rawMouldID, 10);
      if (!Number.isNaN(alt)) {
        CheckListID = alt;
        MouldID = rawCheckListID;
      } else {
        return middlewares.standardResponse(response, null, 400, 'Invalid CheckListID or MouldID');
      }
    }

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
      ,H.[MouldID]
      ,H.[LastUpdatedTime],
         c.[CheckListName]
  FROM Mould_Execute_HCCheckPoint H
  JOIN 
    Config_Mould_HCChecklist c
    ON H.CheckListID = c.CheckListID
WHERE 
    H.CheckListID = @CheckListID
    AND H.MouldID = @MouldID
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('CheckListID', sqlConnection.sql.Int, CheckListID);
  sqlRequest.input('MouldID', sqlConnection.sql.NVarChar(50), MouldID);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(response, null, 300, 'Error executing query: ' + err);
    } else {
      middlewares.standardResponse(response, result.recordset, 200, 'Success');
    }
  });
});

module.exports = router;