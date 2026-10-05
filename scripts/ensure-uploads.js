const fs = require("fs");
const path = require("path");

const uploadsPath = path.join(process.cwd(), "public", "uploads");

try {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log(`Uploads directory ready: ${uploadsPath}`);
} catch (error) {
  console.error("Failed to create uploads directory:", error);
  process.exit(1);
}
