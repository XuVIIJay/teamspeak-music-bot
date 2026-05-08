import axios from "axios";

export async function askAI(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const res = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: systemPrompt ?? "你是TeamSpeak语音聊天机器人。回答尽量简短，不要分段长文本，不要输出无关内容。"
          },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    const text = res.data?.choices?.[0]?.message?.content?.trim() || "无回复";
    return text.length > 200 ? text.slice(0, 200) + "..." : text;
  } catch (err) {
    console.error("AI ERROR:", err);
    return "AI请求失败";
  }
}
