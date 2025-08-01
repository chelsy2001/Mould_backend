const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Creates the folder if not present
}

const filePath = path.join(uploadDir, `${mouldID}.jpg`);
fs.writeFileSync(filePath, file.buffer); // Saves the file as mouldID.jpg
