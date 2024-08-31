import { z } from "zod";
import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 定数
const COUNT = 100;
const COLUMNS = ['name','catch']
const OTHER_COLUMNS = ['genre_name']
let RESPONSE_FORMAT = '{'+COLUMNS.map((columnName)=>`${columnName}: restaurant ${columnName}`).join(', ')
RESPONSE_FORMAT += OTHER_COLUMNS.map((columnName)=>`${columnName}: restaurant ${columnName}`).join(', ')
RESPONSE_FORMAT += '}'

// 状態
function createState() {
  let state = { latitude: 0, longitude: 0 };
  function setState(newState) {
    state = { ...newState };
  }
  function getState() {
    return state;
  }
  return { setState, getState };
}
const state = createState();

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
    const currentState = state.getState();
    // 飲食店情報を取得
    const restaurant = await fetch(
      `http://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${process.env.HOTPEPPER_API_KEY}&lat=${currentState.latitude}&lng=${currentState.longitude}&count=${COUNT}&format=json`,
    );
    // jsonにする
    const restaurantJson = await restaurant.json();
    // 店の情報のみを取り出す
    const restaurantArray = restaurantJson.results.shop;
    // 使う情報を取り出す
    const restaurantText = restaurantArray.map((arr)=>{
      let resultText = '';
      // COLUMNSにあるカラム名を追加
      for(const columnName of COLUMNS){
        resultText += `${columnName}: ${arr[`${columnName}`]}, `
      }
      // その他を手動で追加
      resultText += `genre_name: ${arr.genre.name}`
      return resultText
    })
    // console.log(restaurantText);
    return restaurantText;
  },
  {
    name: "getRestaurant",
    description: "ユーザーの周辺の飲食店を取得します。引数は入れないでください。",
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
  state.setState({
    latitude: request.body.latitude,
    longitude: request.body.longitude,
  });
  const systemPromptText = `あなたは飲食店を提案するアシスタントです。ユーザーにおすすめの飲食店を提案してください。getRestaurant関数を1回だけ呼び出して飲食店の情報を得てください。getRestaurant関数は一度だけ呼び出してください。そのあと、その中から最もユーザーに適していると思われる店の情報をjson形式で3つ出力してください。[${RESPONSE_FORMAT}]のフォーマットで回答してください。`;
  // クライアントから送られてきたデータは無条件で信用しない
  if (typeof promptText !== "string") {
    response.sendStatus(400);
    return;
  }

  const messages = [
    new SystemMessage(systemPromptText),
    new HumanMessage(promptText),
  ];
  const aiMessageChunk = await chatModelWithTools.invoke(messages);
  messages.push(aiMessageChunk);
  // function calling
  while (
    messages[messages.length - 1].response_metadata.finish_reason ===
    "tool_calls"
  ) {
    // 関数を実行
    const tool_calls = messages[messages.length - 1].tool_calls
    for (const toolCall of tool_calls) {
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
  // debug
  // console.log(state.getState());
  console.log(messages);
  response.json({ content: messages[messages.length - 1].content });
});

// 使用するホスティングサービス (Render など) によってはリクエストを受け付けるポートが指定されている場合がある。
// たいていの場合は PORT という名前の環境変数を通して参照できる。
app.listen(process.env.PORT || 3000);
