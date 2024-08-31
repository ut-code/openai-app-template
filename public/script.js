const chatMessagesElement = document.getElementById("chat-messages");
const chatMessageTemplateElement = document.getElementById(
  "chat-message-template",
);
const inputFormElement = document.getElementById("input-form");
const promptTextInputElement = document.getElementById("prompt-text-input");

const locationInformationElement = document.getElementById(
  "location-information",
);

inputFormElement.onsubmit = async (event) => {
  // フォームが送信されたときのページ遷移を防ぐ
  event.preventDefault();
  // 現在位置を取得
  function getCoordinates() {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject),
    );
  }
  getCoordinates()
    .then(async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const locationText = `緯度: ${latitude}, 経度: ${longitude}`;
      locationInformationElement.textContent = locationText;

      const promptText = promptTextInputElement.value.trim();
      if (promptText === "") return;
      promptTextInputElement.value = "";

      const yourChatMessage = { content: promptText };
      addChatMessageElement("you", yourChatMessage);

      const aiChatMessage = await postChat({
        promptText,
        latitude: latitude,
        longitude: longitude,
      });
      addChatMessageElement("ai", aiChatMessage);
    })
    .catch((error) => {
      window.alert("位置情報の取得に失敗しました。エラーコード：" + error.code);
    });
};

// /chat に POST リクエストを送信する
async function postChat(request) {
  const response = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return await response.json();
}

// メッセージを画面に描画する
function addChatMessageElement(author, chatMessage) {
  // template 要素 (HTMLTemplateElement) は content プロパティを持ち、cloneNode メソッドで複製して利用できる
  // 引数に true を渡すと子孫要素も複製される
  const fragment = chatMessageTemplateElement.content.cloneNode(true);
  // querySelector メソッドを用いると呼ばれたクラス内の要素を CSS のセレクタの記法で検索できる
  const rootElement = fragment.querySelector(".chat-message");
  const authorElement = fragment.querySelector(".chat-message__author");
  const contentElement = fragment.querySelector(".chat-message__content");
  const deleteButtonElement = fragment.querySelector(
    ".chat-message__delete-button",
  );

  // classList プロパティを使うと HTML の class 属性を簡単に操作できる
  rootElement.classList.add(`chat-message--${author}`);
  const authorLabelMap = { you: "あなた", ai: "AI" };
  authorElement.textContent = authorLabelMap[author];
  contentElement.textContent = chatMessage.content;
  deleteButtonElement.onclick = () => {
    rootElement.remove();
  };
  chatMessagesElement.appendChild(fragment);
}

const recognition = new webkitSpeechRecognition();
recognition.lang = 'ja-JP';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    console.log('Result: ', speechResult);

    // 取得した音声結果をテキスト入力に設定
    promptTextInputElement.value = speechResult;

};

// 音声認識の開始をボタンクリックなどのユーザーイベントに紐づける
document.getElementById('start-recognition-button').onclick = () => {
    recognition.start();
};
