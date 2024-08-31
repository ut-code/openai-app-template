const chatMessagesElement = document.getElementById("chat-messages");
const chatMessageTemplateElement = document.getElementById(
  "chat-message-template",
);
const restaurantCardsElement = document.getElementById("restaurant-cards");
const restaurantCardTemplateElement = document.getElementById(
  "restaurant-card-template",
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
      while (true) {
        try {
          const aiChatMessage = await postChat({
            promptText,
            latitude: latitude,
            longitude: longitude,
          });
          const recommendedRestaurantList = JSON.parse(aiChatMessage.content);
          addChatMessageElement("ai", aiChatMessage, recommendedRestaurantList);
          break;
        } catch (error) {
          continue;
        }
      }
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
function addChatMessageElement(author, chatMessage, recommendedRestaurantList) {
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
  if (author === "you")
  chatMessagesElement.appendChild(fragment);
  if (author === "ai") {
    document.getElementById("input-form").innerHTML = ""
    // for (const restaurant of recommendedRestaurantList) {
    //   const restaurantCardFragment =
    //     restaurantCardTemplateElement.content.cloneNode(true);
    //   const restaurantCardNameElement =
    //     restaurantCardFragment.querySelector(".restaurant-name");
    //   const restaurantCardGenreElement =
    //     restaurantCardFragment.querySelector(".restaurant-genre");
    //   const restaurantCardPhotoElement =
    //     restaurantCardFragment.querySelector(".restaurant-photo");
    //   restaurantCardNameElement.textContent = restaurant.name;
    //   restaurantCardGenreElement.textContent = restaurant.genre_name;
    //   restaurantCardPhotoElement.src = restaurant.photo;
    //   restaurantCardsElement.appendChild(restaurantCardFragment);
    // }
      
  let currentIndex = 0;
  showDialog(currentIndex);
  function showDialog(currentIndex) {
    const restaurantData = recommendedRestaurantList[currentIndex];
    // ダイアログの要素
    const dialog = document.getElementById("restaurantDialog");
    const closeButton = document.getElementById("closeDialog");

    document.getElementById("restaurantImage").src = restaurantData.photo;
    document.getElementById("restaurantName").textContent = restaurantData.name;
    document.getElementById("restaurantGenre").textContent = "ジャンル: " + restaurantData.genre_name;
    document.getElementById("restaurantBudget").textContent = "予算: " + restaurantData.budget;
    document.getElementById("restaurantTime").textContent = "所要時間: " + restaurantData.time;
    dialog.showModal();

    document.getElementById("yes-button").onclick = () => {
    alert('選択されました: ' + restaurantData.name);
    }

    document.getElementById("no-button").onclick = () => {
      currentIndex++;
      if (currentIndex <= recommendedRestaurantList.length - 1) {
        dialog.close();
        showDialog(currentIndex);
      } else {
        location.reload();
      }
    }


    // ダイアログを閉じる
    closeButton.onclick = function() {
        dialog.close();
    };

    // ダイアログの外側をクリックすると閉じる
    window.onclick = function(event) {
        if (event.target === dialog) {
            dialog.close();
        }
    };
  }

    }
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

    //フォームを自動送信
    const submitButton = document.querySelector('#input-form button[type="submit"]');
            if (submitButton) {
                submitButton.click();
            }

};

// 音声認識の開始をボタンクリックなどのユーザーイベントに紐づける
document.getElementById('start-recognition-button').onclick = () => {
    recognition.start();
};
