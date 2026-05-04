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
      // Rotate common user agents
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      const response = await axios.get("https://adhahi.dz/register", {
        headers: {
          "User-Agent": randomUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ar-DZ,ar;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        timeout: 15000, // Increase timeout to 15s
        validateStatus: () => true // Accept any status code to debug
      });

      if (response.status !== 200) {
        throw new Error(`الموقع استجاب برمز خطأ: ${response.status}`);
      }

      const $ = cheerio.load(response.data);
      const pageText = $("body").text();
      
      // Keywords that typically indicate unavailability in Algeria's Adhahi platform
      const noStrockKeywords = ["لا توجد", "غير متوفر", "نفدت", "متوفرة حاليا", "انتهاء العملية"];
      const hasAvailability = !noStrockKeywords.some(kw => pageText.includes(kw));

      const wilayas: string[] = [];
      $("select[name='wilaya'] option, select#wilaya option").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("إختر") && !text.includes("Sélectionner")) {
          wilayas.push(text);
        }
      });

      res.json({
        success: true,
        available: hasAvailability || wilayas.length > 0,
        wilayas: wilayas,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({
        success: false,
        error: "فشل الوصول لموقع الأضاحي. قد يكون الموقع مغلقاً للصيانة أو محجوباً عن الخادم.",
        details: error.message
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
