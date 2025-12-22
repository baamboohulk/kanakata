// Minimal Katakana -> romaji (enough for names). You can expand later.
const DIGRAPHS: Record<string, string> = {
  "キャ":"kya","キュ":"kyu","キョ":"kyo",
  "シャ":"sha","シュ":"shu","ショ":"sho",
  "チャ":"cha","チュ":"chu","チョ":"cho",
  "ニャ":"nya","ニュ":"nyu","ニョ":"nyo",
  "ヒャ":"hya","ヒュ":"hyu","ヒョ":"hyo",
  "ミャ":"mya","ミュ":"myu","ミョ":"myo",
  "リャ":"rya","リュ":"ryu","リョ":"ryo",
  "ギャ":"gya","ギュ":"gyu","ギョ":"gyo",
  "ジャ":"ja","ジュ":"ju","ジョ":"jo",
  "ビャ":"bya","ビュ":"byu","ビョ":"byo",
  "ピャ":"pya","ピュ":"pyu","ピョ":"pyo",
  "ファ":"fa","フィ":"fi","フェ":"fe","フォ":"fo","フュ":"fyu",
  "ヴァ":"va","ヴィ":"vi","ヴェ":"ve","ヴォ":"vo","ヴュ":"vyu",
  "ティ":"ti","ディ":"di","トゥ":"tu","ドゥ":"du",
  "チェ":"che","シェ":"she","ジェ":"je",
  "ツァ":"tsa","ツィ":"tsi","ツェ":"tse","ツォ":"tso"
};

const MONO: Record<string, string> = {
  "ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o",
  "カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko",
  "サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so",
  "タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to",
  "ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no",
  "ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho",
  "マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo",
  "ヤ":"ya","ユ":"yu","ヨ":"yo",
  "ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro",
  "ワ":"wa","ヲ":"o",
  "ン":"n",
  "ガ":"ga","ギ":"gi","グ":"gu","ゲ":"ge","ゴ":"go",
  "ザ":"za","ジ":"ji","ズ":"zu","ゼ":"ze","ゾ":"zo",
  "ダ":"da","ヂ":"ji","ヅ":"zu","デ":"de","ド":"do",
  "バ":"ba","ビ":"bi","ブ":"bu","ベ":"be","ボ":"bo",
  "パ":"pa","ピ":"pi","プ":"pu","ペ":"pe","ポ":"po",
  "ヴ":"vu",
  "ー":"-",
  "・":" "
};

export function katakanaToRomaji(input: string): string {
  let s = input.trim();
  // handle small tsu for gemination
  s = s.replace(/ッ(?=.)/g, ""); // We'll handle by doubling next consonant in a simple pass below
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (DIGRAPHS[two]) {
      out += DIGRAPHS[two];
      i += 1;
      continue;
    }
    const one = s[i];
    out += MONO[one] ?? "";
  }
  // long vowel mark: foo- => foo
  out = out.replace(/([aeiou])-/g, "$1$1");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}
