import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyCaM7pY1wd_ESz8XHQCpRiyKYPvaNzU8qs");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function test() {
  try {
    const result = await model.generateContent("Say hello!");
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
