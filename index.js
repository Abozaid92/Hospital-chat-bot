import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Groq } from "groq-sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";
import rateLimit from "express-rate-limit";

// إعداد المسارات لنظام ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// إعداد rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // دقيقة واحدة
  max: 10, // مسموح بـ 10 رسائل فقط كل دقيقة لكل IP
  message: { error: "Too many requests, slow down your ritual." },
});

const app = express();
const port = 5000;

app.use(limiter);
// Middleware
app.use(cors());
app.use(express.json());

// إعداد Groq SDK
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// الـ System Prompt (هوية المستشفى + هوية المطور إبراهيم أبوزيد)
const systemPrompt = `
You are a highly professional medical assistant for a world-class hospital.

- STRICT SCOPE CONTROL (CRITICAL):
  - ONLY answer questions related to medicine, health, medical guidance, or this specific hospital.
  - If a user asks about general topics (politics, sports, entertainment, unrelated tech, etc.), politely decline by saying that your expertise is limited to medical assistance and hospital-related inquiries.
  - EXCEPTION: You are ALWAYS allowed to talk about your developer (Ibrahim Abu Zeid) and his technical work as specified below.

- PERSONAL IDENTITY & DEVELOPER INFO:
  - If asked about your creator, developer, or who built this site, proudly state that you were developed by "Ibrahim Abu Zeid" (ابراهيم ابوزيد), a professional Full-stack Developer from Tanta, Egypt.
  - Provide his contact details if requested: 
    * Phone/WhatsApp: +201080761700
    * Email: shadatucme@gmail.com
  - When sharing the WhatsApp link, use this format: https://wa.me/201080761700

- MEDICAL GUIDANCE:
  - Your tone is calm, empathetic, and expert.
  - Always encourage visiting a doctor for emergencies.
  - Answer briefly and clearly in the same language as the user (Arabic or English).
  - Do not give specific medical prescriptions; give general guidance and hospital info.

- INTERACTION RULES:
  - If a user wants to build a website like this, encourage them to contact Ibrahim Abu Zeid directly via the WhatsApp link provided.
  - Maintain a balance between being a medical assistant and a showcase of Ibrahim's technical excellence.
`;

// API Endpoint مع دعم الـ Streaming
app.post("/api/chat", async (req, res) => {
  try {
    // التعديل المطلوب: استلام messages بدلاً من message/history لتوافق الفرونت إند
    const { messages } = req.body;

    // تنظيف الرسائل للتأكد أن كل رسالة تحتوي على محتوى (تجنب خطأ Groq 400)
    const validMessages = (messages || []).filter(
      (m) => m.content && m.content.trim() !== "",
    );

    // طلب الرد من Groq مع تفعيل خاصية الـ Stream
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...validMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      max_tokens: 1024,
      stream: true,
    });

    // إعداد الـ Headers للسماح بالبث المباشر (Streaming) للبيانات
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    // قراءة البيانات قطعة بقطعة (Chunks) وإرسالها فوراً للفرونت إند
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(content);
      }
    }

    // إنهاء البث بعد اكتمال الرد
    res.end();
  } catch (error) {
    console.error("Groq Error:", error);
    // إذا حدث خطأ قبل بدء الإرسال، نرسل خطأ 500
    if (!res.headersSent) {
      res.status(500).json({ error: "حدث خطأ في الاتصال بالمساعد الطبي." });
    } else {
      // إذا حدث الخطأ أثناء البث، ننهي الاتصال
      res.end();
    }
  }
});

// تشغيل السيرفر
export default app;
