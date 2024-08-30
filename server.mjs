import { z } from "zod";
import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// グローバル変数
const position = { latitude: 0, longitude: 0 };

// toolを定義
const addTool = tool(
  async ({ a, b }) => {
    return a + b;
  },
  {
    name: "add",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
    description: "Adds a and b.",
  },
);

const multiplyTool = tool(
  async ({ a, b }) => {
    return a * b;
  },
  {
    name: "multiply",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
    description: "Multiplies a and b.",
  },
);

const forecastTool = tool(
  async () => {
    const forecast = await fetch(
      "https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json",
    );
    const forecastJson = await forecast.json();
    const forecastText = forecastJson.text;
    return await forecastText;
  },
  {
    name: "getForecast",
    description: "東京都の天気予報を取得します",
  },
);

const restaurantTool = tool(
  async () => {
    const COUNT = 100;
    const restaurant = await fetch(
      `http://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${process.env.HOTPEPPER_API_KEY}&lat=${position.latitude}&lng=${position.longitude}&count=${COUNT}&format=json`,
    );
    const restaurantJson = await restaurant.json();
    const restaurantText = restaurantJson.results.shop;
    // console.log(restaurantText);
    return "おいしいレストランがあります";
  },
  {
    name: "getRestaurant",
    description: "ユーザーの周辺の飲食店を取得します",
  },
);

const tools = [addTool, multiplyTool, forecastTool, restaurantTool];

const toolsByName = {
  add: addTool,
  multiply: multiplyTool,
  getForecast: forecastTool,
  getRestaurant: restaurantTool,
};

// LangChain の ChatOpenAI クラスは OPENAI_API_KEY 環境変数を自動的に参照する
const chatModel = new ChatOpenAI();
const chatModelWithTools = chatModel.bindTools(tools);

const app = express();

// public ディレクトリ下のファイルに適切なパスでアクセスできるようにする
app.use(express.static("./public"));

// リクエストボディを JSON として解釈して request.body に格納する
app.use(express.json());

app.post("/chat", async (request, response) => {
  // システムプロンプト
  const promptText = request?.body?.promptText;
  position.latitude = request.body.latitude;
  position.longitude = request.body.longitude;
  const systemPromptText = `あなたは飲食店を提案するアシスタントです。ユーザーにおすすめの飲食店を提案してください。getRestaurant関数を呼び出して飲食店の情報を得てください。`;
  // クライアントから送られてきたデータは無条件で信用しない
  if (typeof promptText !== "string") {
    response.sendStatus(400);
    return;
  }

  const messages = [
    new SystemMessage(systemPromptText),
    new HumanMessage(promptText),
  ];
  const aiMessageChunk = await chatModelWithTools.invoke(promptText);
  messages.push(aiMessageChunk);
  // function calling
  while (
    messages[messages.length - 1].response_metadata.finish_reason ===
    "tool_calls"
  ) {
    // 関数を実行
    for (const toolCall of aiMessageChunk.tool_calls) {
      const selectedTool = toolsByName[toolCall.name];
      const toolMessage = await selectedTool.invoke(toolCall);
      // 実行結果をmessagesにのせる
      messages.push(toolMessage);
    }
    // 関数の実行結果をもとに最終的な返答を得る
    const aiMessageChunkAfterToolCall = await chatModelWithTools.invoke(
      messages,
    );
    messages.push(aiMessageChunkAfterToolCall);
  }
  // console.log(messages);
  response.json({ content: messages[messages.length - 1].content });
});

// 使用するホスティングサービス (Render など) によってはリクエストを受け付けるポートが指定されている場合がある。
// たいていの場合は PORT という名前の環境変数を通して参照できる。
app.listen(process.env.PORT || 3000);
