const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const sql = require("mssql");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();


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
module.exports = router;