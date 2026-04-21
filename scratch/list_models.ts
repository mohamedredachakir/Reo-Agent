import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyCaM7pY1wd_ESz8XHQCpRiyKYPvaNzU8qs");

async function test() {
  try {
    // Attempt to list models to see what this key can access
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCaM7pY1wd_ESz8XHQCpRiyKYPvaNzU8qs`);
    const data = await response.json();
    console.log("Available models:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
