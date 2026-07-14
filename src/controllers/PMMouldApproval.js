const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.get('/GetCheckPoints/:CheckListID/:MouldID', (request, response) => {
  // tolerate swapped params from client: try to resolve numeric CheckListID
  const rawCheckListID = request.params.CheckListID;
  const rawMouldID = request.params.MouldID;

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
JOIN 
    Config_Mould_PMCheckList c
    ON p.CheckListID = c.CheckListID
WHERE 
    p.CheckListID = @CheckListID   
    AND p.MouldID = @MouldID
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