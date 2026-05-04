import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route to check Adhahi availability
  app.get("/api/check", async (req, res) => {
    try {
      // User agent to avoid bot detection
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      
      const response = await axios.get("https://adhahi.dz/register", {
        headers: {
          "User-Agent": userAgent,
          "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      
      // Based on common "No Adhahi" patterns, we look for messages like "لا توجد أضاحي متوفرة"
      const pageText = $("body").text();
      const hasAvailability = !pageText.includes("لا توجد أضاحي متوفرة") && !pageText.includes("متوفرة حاليا");

      // We can also look for the dropdown of wilayas if it exists
      const wilayas: string[] = [];
      $("select[name='wilaya'] option").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("إختر")) {
          wilayas.push(text);
        }
      });

      res.json({
        success: true,
        available: hasAvailability,
        wilayas: wilayas,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error checking adhahi.dz:", error.message);
      res.status(500).json({
        success: false,
        error: "Could not reach adhahi.dz. The site might be down or protected.",
        message: error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
