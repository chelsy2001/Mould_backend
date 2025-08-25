const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.patch("/update", (request, response) => {
  const { MouldID } = request.body;
  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('MouldID', sqlConnection.sql.NVarChar, MouldID);
  sqlRequest.execute('SP_OnPMConfirmationButton', (err, result) => {
      if (err) {
        if (err.originalError && err.originalError.info && err.originalError.info.number === 50001) {
            middlewares.standardResponse(
                response,
                null,
                409, // Conflict
                err.originalError.info.message
            );
        } else {
            middlewares.standardResponse(
              response,
              null,
              500, // Internal Server Error
              "Error executing query: " + err
            );
            console.error("Error executing query:", err);
        }
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
    `SELECT CheckListID FROM Config_Mould_PMSchedule WHERE MouldID = '${mouldid}'`,
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
router.get("/PMDetails/:CheckListID", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT 
    CMP.CheckListID,
    CMP.EquipmentID,
    CMP.MouldID,
    CMP.PMFreqCount,
    CMP.PMFreqDays,
    CMP.PMWarningCount,
    CMP.PMWarningDays,
    CMP.MaterialID,
    CM.MaterialName,        
    CMP.Instance,
    CMP.PMStatus
FROM Config_Mould_PMSchedule CMP
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
