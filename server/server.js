const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());  // CORSを有効化。フロントエンドのポートは3000、バックエンドは5000、これが通信可能にする。

//POSTリクエストを受け取るAPIエンドポイントを設定（/api/serch）
app.post('/api/search', async (req, res) => {
  const { query } = req.body; //フロントエンドから来たリクエストボディ（req.body）からquery取得。
  const url = 'https://pdl-1-pdf-html.vercel.app/';  // 対象のウェブサイトURL
  
  //axiosはNode.jsで使える、指定したウェブサイト(URL)に対してGETリクエストを送り、HTMLを取得する。
  try {
    const { data } = await axios.get(url, {
      params: { q: query }
    });

    //cheerioはNode.js用の軽量なスクレイピングライブラリで、dataとして取得したHTMLからPDFファイルのリンクを探索する。
    const $ = cheerio.load(data);
    let pdfLinks = [];

    // .pdfで終わるリンクを選択して、そのリンクを配列pdfLinksに格納
    $('a[href$=".pdf"]').each((index, element) => {
      const link = new URL($(element).attr('href'), url).href;  // 相対パスに対応
      pdfLinks.push(link);
    });

    if (pdfLinks.length === 0) {
      return res.status(404).json({ message: 'PDFファイルが見つかりませんでした' });
    }


    const pdfUrl = pdfLinks[0];
    
    //axiosを使ってPDFファイルのデータをarraybufferで取得
    const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });

    //pdf-parseライブラリを使ってその内容をテキスト形式に変換
    const pdfData = await pdfParse(pdfResponse.data);

    const pdfText = pdfData.text;

    //pdfTextから、ユーザーが入力したqueryに関連する部分を抽出する。extractRelevantContent関数は下部で定義
    const relatedContent = extractRelevantContent(pdfText, query);

    if (!relatedContent) {
      return res.status(404).json({ message: '関連する情報が見つかりませんでした' });
    }

    //フロントエンドにresponse返す
    res.json({ relatedContent });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

//検索クエリの前後50文字の範囲で一致するテキストを検索する関数 extractRelevantContent
function extractRelevantContent(text, query) {
  const regex = new RegExp(`.{0,50}${query}.{0,50}`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.join('\n') : null;
}

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
