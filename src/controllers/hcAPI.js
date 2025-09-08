const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.patch("/update", (request, response) => {
  new sqlConnection.sql.Request().query(
    `EXEC [SP_OnHCConfirmationButton] @MouldID = ${request.body.MouldID};`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        console.dir(result.recordset);
      }
    }
  );
});


//Get Checklist by MouldID
router.get("/checklist/:mouldid", (request, response) => {
  const { mouldid } = request.params;
  new sqlConnection.sql.Request().query(
    `SELECT CheckListID FROM Config_Mould_HCSchedule WHERE MouldID = '${mouldid}'`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        console.dir(result.recordset);
      }
    }
  );
});

//Get PM Details details
router.get("/HCDetails/:CheckListID", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT 
    CMP.CheckListID,
    CMP.EquipmentID,
    CMP.MouldID,
    CMP.HCFreqCount,
    CMP.HCFreqDays,
    CMP.HCWarningCount,
    CMP.HCWarningDays,
    CMP.MaterialID,
    CM.MaterialName,        
    CMP.Instance,
    CMP.HCStatus
FROM Config_Mould_HCSchedule CMP
LEFT JOIN Config_Material CM ON CMP.MaterialID = CM.MaterialID
WHERE CMP.CheckListID = '${request.params.CheckListID}';
; 
    `,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        console.dir(result.recordset);
      }
    }
  );
});
module.exports = router;
