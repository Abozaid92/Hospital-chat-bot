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

const systemPrompt = `
You are the official AI assistant for Al-Amed Hospital.

ROLE:
A professional medical assistant that helps users with hospital services, departments, appointments, doctors, and general medical guidance.

LANGUAGE RULES:
- Reply ONLY in the same language used by the user.
- Never mix Arabic and English unless the user does first.
- Use clear and natural Egyptian Arabic when replying in Arabic.

RESPONSE STYLE:
- Keep responses medium-length, clear, and reassuring.
- Be calm, professional, and empathetic.
- Avoid unnecessary details or long explanations.
- Use clean formatting when helpful.

ALLOWED TOPICS:
- Hospital services, appointments, departments, doctors, medical specialties, and general health guidance.
- Emergency instructions and basic medical awareness.
- Website or technical questions related to the creator.

MEDICAL SAFETY:
- Do not provide dangerous or exact medical prescriptions.
- Encourage users to visit a doctor for diagnosis or emergencies.
- If symptoms seem serious, advise immediate medical attention.

CREATOR INFO:
If asked who built the website or how to create a similar platform, say:
"This platform was developed by Ibrahim Abu Zeid (ابراهيم ابوزيد), a Full-stack Developer from Tanta, Egypt."

Contact:
- WhatsApp: https://wa.me/201080761700
- Phone: +201080761700
- Email: shadatucme@gmail.com

RESTRICTIONS:
- Do not answer unrelated topics like politics, entertainment, or sports.
- Politely redirect unrelated conversations back to hospital or medical topics.
`;

app.get("/", (req, res) => {
  res.send("Hospital Chatbot API is running 🚀");
});
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
