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

  // DEBUG Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Route to check Adhahi availability
  app.get("/api/check", async (req, res) => {
    console.log("GET /api/check requested");
    try {
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      // First, try a HEAD or quick GET to verify reachability
      const targetUrl = "https://adhahi.dz/register";
      
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": randomUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar-DZ,ar;q=0.9",
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 403 || response.status === 405) {
         throw new Error(`الموقع يحجب الوصول (رقم الخطأ: ${response.status}). قد يكون بسبب قيود برمجية.`);
      }

      if (response.status !== 200) {
        throw new Error(`الموقع استجاب برمز خطأ غير متوقع: ${response.status}`);
      }

      const $ = cheerio.load(response.data);
      const pageText = $("body").text();
      
      const noStockKeywords = ["لا توجد", "غير متوفر", "نفدت", "متوفرة حاليا", "انتهاء العملية", "لا توجد أضاحي"];
      const hasAvailability = !noStockKeywords.some(kw => pageText.includes(kw));

      const wilayas: string[] = [];
      $("select option").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("إختر") && !text.includes("Sélectionner") && text.length > 2) {
          wilayas.push(text);
        }
      });

      res.json({
        success: true,
        available: hasAvailability || wilayas.length > 0,
        wilayas: wilayas,
        timestamp: new Date().toISOString(),
        status: response.status
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({
        success: false,
        error: "تعذر الاتصال بموقع الأضاحي",
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
