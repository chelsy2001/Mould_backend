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



router.get('/GetCheckPoints/:CheckListID/:MouldID', (request, response) => {
  const {CheckListID ,MouldID} = request.params;

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
  INNER JOIN  
    Config_Mould_HCChecklist c
    ON H.CheckListID = c.CheckListID
WHERE 
    H.CheckListID = @CheckListID AND H.MouldID = @MouldID
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
    } else {
     return middlewares.standardResponse(
           response,
           result.recordset,
           200,
           'Success'
         );
    }
  });
});

// update api to update the Checkpointsn observation
router.post('/UpdateCheckPointStatus', async (req, res) => {
  const { CheckPointID,UID, MouldID, Observation, OKNOK } = req.body;

  if ((!CheckPointID && !UID )|| OKNOK === undefined) {
    return middlewares.standardResponse(res, null, 400, "Missing required fields.Provide CheckPointID or UID and OKNOK.");
  }

  try {

     let resolvedMouldID = MouldID;
    
        if (!resolvedMouldID) {
          const idRequest = new sqlConnection.sql.Request();
          let idQuery;
    
          if (UID) {
            idQuery = `SELECT MouldID FROM Mould_Execute_HCCheckPoint WHERE UID = @UID`;
            idRequest.input('UID', sql.Int, UID);
          } else {
            idQuery = `SELECT MouldID FROM Mould_Execute_HCCheckPoint WHERE CheckPointID = @CheckPointID`;
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

    const query = `
      UPDATE Mould_Execute_HCCheckPoint
      SET 
        Observation = @Observation,
        OKNOK = @OKNOK,
        LastUpdatedTime = GETDATE()
      WHERE 
        CheckPointID = @CheckPointID and MouldID = @MouldID
    `;

    const sqlRequest = new sqlConnection.sql.Request();
    sqlRequest.input('Observation', sql.NVarChar, Observation ?? '');
    sqlRequest.input('OKNOK', sql.Int, OKNOK); // 1 for OK, 2 for NOK
    sqlRequest.input('CheckPointID', sql.Int, CheckPointID);
    sqlRequest.input('MouldID', sql.NVarChar(50), resolvedMouldID);
    

    await sqlRequest.query(query);

    middlewares.standardResponse(res, null, 200, "CheckPoint status updated successfully.");
  } catch (err) {
    middlewares.standardResponse(res, null, 500, "Database error: " + err.message);
  }
});

//Submit Button Functionality


router.post('/SubmitHCChecklist', async (req, res) => {
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
    // 1. Check count of NULL OKNOK entries
    const checklistResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT COUNT(*) AS NullCount 
        FROM Mould_Execute_HCCheckPoint 
        WHERE OKNOK IS NULL AND CheckListID = @CheckListID  AND MouldID = @MouldID
      `);
     if (checklistResult.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        404,
        "Checklist not found for selected Mould."
      );
    }
    //1. Check count of NULL OKNOK entries
     const nullCountResult = await new sqlConnection.sql.Request()
          .input('CheckListID', sqlConnection.sql.Int, CheckListID)
          .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
          .query(`
            SELECT COUNT(*) AS NullCount
            FROM Mould_Execute_HCCheckPoint
            WHERE CheckListID = @CheckListID
              AND MouldID = @MouldID
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
    // 2. Check count of NOK entries
    const nokCountResult = await new sqlConnection.sql.Request()
      .input('CheckListID', sqlConnection.sql.Int, CheckListID)
      .input('MouldID', sqlConnection.sql.NVarChar(50), MouldID)
      .query(`
        SELECT COUNT(*) AS NOKCount 
        FROM Mould_Execute_HCCheckPoint 
        WHERE OKNOK = 2 AND CheckListID = @CheckListID AND MouldID = @MouldID
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


    if (!MouldID) {
      return middlewares.standardResponse(res, null, 404, "MouldID not found.");
    }

    // 4. Update Config_PMSchedule PMStatus to 6
    await new sqlConnection.sql.Request()
      .query(`
        UPDATE Config_Mould_HCSchedule
        SET HCStatus = 5 WHERE CheckListID = ${CheckListID} and MouldID='${MouldID}'
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
// to save the img
router.post("/upload-image-to-checkpoint/:checklistID/:checkpointID", upload.single("image"), async (req, res) => {
  const { checklistID, checkpointID } = req.params;
  const file = req.file;

  if (!file) {
    return middlewares.standardResponse(res, null, 400, "❌ No image file uploaded.");
  }

  try {
    // Save image to folder
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "_").slice(0, 19);
    const uploadDir = path.join(__dirname, "../uploads/HCcheckpoints");
    
    // Ensure the folder exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // File path: uploads/checkpoints/ChecklistID_CheckPointID_timestamp.jpg
    const fileName = `Checklist${checklistID}_Checkpoint${checkpointID}_${timestamp}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    // Optional: Update DB with just the image path (if needed)
    const pool = await sqlConnection.sql.connect();
    const request = pool.request();
   request.input("Image", sqlConnection.sql.VarBinary(sqlConnection.sql.MAX), file.buffer);
   request.input("ChecklistID", sqlConnection.sql.Int, checklistID);
  request.input("CheckPointID", sqlConnection.sql.Int, checkpointID);

    await request.query(`
       UPDATE [dbo].[Mould_Execute_HCCheckPoint]
      SET [Image] = @Image, [LastUpdatedTime] = GETDATE()
      WHERE [CheckListID] = @ChecklistID AND [CheckPointID] = @CheckPointID
    `);

    middlewares.standardResponse(res, null, 200, "✅ Image uploaded and saved to folder.");
  } catch (error) {
    console.error("❌ Upload error:", error);
    middlewares.standardResponse(res, null, 500, "❌ Failed to upload image.");
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
          FROM Mould_Execute_HCCheckList
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

      const uploadDir = path.join(__dirname, "../uploads/HCcheckpoints");

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