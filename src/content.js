// // 誤表記リスト（初期値）
// const misspellings = {
//   "\\b[bB]uffalose\\b": "Buffaloes",       // Buffalose → Buffaloes
//   "\\bバッファローズ\\b": "バファローズ",   // バッファローズ → バファローズ
//   "\\bBuffalos\\b": "Buffaloes",            // Buffalos → Buffaloes
//   "\\b[bB]uffalos\\b": "Buffaloes",         // buffalos → Buffaloes
//   "オリックスバッファローズ": "オリックス・バファローズ" // オリックスバッファローズ → オリックス・バファローズ
// };

// 誤表記リスト（初期値）
const misspellings = {
  "バッファローズ": "バファローズ",
  "buffalose": "buffaloes"
};

// テキストフィールドやテキストエリアの監視
document.querySelectorAll('textarea, input[type="text"]').forEach((inputField) => {
  inputField.addEventListener('input', (event) => {
    checkText(event.target);
  });
});

// 誤表記の検出
function checkText(inputField) {
  let content = inputField.value;
  Object.keys(misspellings).forEach(misspelledWord => {
    let correctWord = misspellings[misspelledWord];
    if (content.includes(misspelledWord)) {
      // コンソールで警告を表示、後でハイライト等に変更可能
      console.warn(`誤表記を発見: ${misspelledWord} → ${correctWord}`);
    }
  });
}

// // テキストフィールドやテキストエリアの監視
// document.querySelectorAll('textarea, input[type="text"]').forEach((inputField) => {
//   inputField.addEventListener('input', (event) => {
//     checkText(event.target);
//   });
// });

// // 誤表記の検出
// function checkText(inputField) {
//   let content = inputField.value;
//   Object.keys(misspellings).forEach(misspelledWord => {
//     let correctWord = misspellings[misspelledWord];
//     if (content.includes(misspelledWord)) {
//       // コンソールで警告を表示、後でハイライト等に変更可能
//       console.warn(`誤表記を発見: ${misspelledWord} → ${correctWord}`);
//     }
//   });
// }
