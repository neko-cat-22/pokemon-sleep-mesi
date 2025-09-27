// script.js
// 全データはこのファイル内に格納できます（recipes や初期 ingredientCandidates など）
// ユーザーの要望に合わせて、ここにレシピを置き、将来的には GitHub raw から読み込む機能を使えます。

/* -------------------------
   初期データ
   ------------------------- */
const ingredientCandidates = [
  "ふといながねぎ",
  "あじわいキノコ",
  "とくせんエッグ",
  "にんじん",
  "じゃがいも",
  "ミルク"
];

// サンプルレシピ（カテゴリごと）
// レシピは {id, name, category, consumes: {ingredient: amount, ...}} の形
const recipes = [
  // カレー・シチュー
  { id: "curry-1", name: "ビーフカレー", category: "curry", consumes: { "ふといながねぎ": 5, "にんじん": 3, "じゃがいも": 4 } },
  { id: "curry-2", name: "チキンシチュー", category: "curry", consumes: { "ふといながねぎ": 3, "ミルク": 2 } },

  // サラダ
  { id: "salad-1", name: "グリーンサラダ", category: "salad", consumes: { "ふといながねぎ": 1, "あじわいキノコ": 2 } },
  { id: "salad-2", name: "ポテトサラダ", category: "salad", consumes: { "じゃがいも": 5, "にんじん": 2 } },

  // デザート・ドリンク
  { id: "dessert-1", name: "ミルクシェイク", category: "dessert", consumes: { "ミルク": 4 } },
  { id: "dessert-2", name: "フルーツデザート", category: "dessert", consumes: { "とくせんエッグ": 1 } },
];

// タイムスロット（朝/昼/夜 × 7日）
const days = ["月曜","火曜","水曜","木曜","金曜","土曜","日曜"];
const times = ["朝","昼","夜"];
const slots = [];
for (let d=0; d<7; d++){
  for (let t=0; t<3; t++){
    slots.push({ id:`slot-${d}-${t}`, label:`${days[d]}${times[t]}` });
  }
}
// 仕様では「初期所持」が表の上にあるため最初に "初期所持" を入れる
const slotLabels = ["初期所持", ...slots.map(s => s.label)];

/* -------------------------
   状態 (State)
   ------------------------- */
const state = {
  // 表に表示する食材の順序と各列の初期所持値
  ingredients: [
    // { name: "ふといながねぎ", initial: 200 }
    { name: "ふといながねぎ", initial: 200 }
  ],
  // helpers: up to 5
  helpers: [
    // {id, species, level, composition, subskill, nickname, baseSupply}
  ],
  // changes: list of {slotIndex, fromHelperId, toHelperId}
  changes: [],
  // chosen category and recipes (ids or "")
  chosen: {
    category: "",
    recipe1: "",
    recipe2: "",
    recipe3: ""
  },
  // recipe database (will be replaced if loaded from URL)
  recipesDB: recipes,
  // computed table values: rows x cols (rows = slotLabels.length)
  computed: []
};

/* -------------------------
   DOM 参照
   ------------------------- */
const ingredientPicker = document.getElementById("ingredientPicker");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const categorySelect = document.getElementById("categorySelect");
const recipe1 = document.getElementById("recipe1");
const recipe2 = document.getElementById("recipe2");
const recipe3 = document.getElementById("recipe3");
const helpersList = document.getElementById("helpersList");
const addHelperBtn = document.getElementById("addHelperBtn");
const helperSpecies = document.getElementById("helperSpecies");
const helperLevel = document.getElementById("helperLevel");
const helperComposition = document.getElementById("helperComposition");
const helperSubskill = document.getElementById("helperSubskill");
const helperBaseSupply = document.getElementById("helperBaseSupply");
const helperNickname = document.getElementById("helperNickname");
const changeSlot = document.getElementById("changeSlot");
const changeFrom = document.getElementById("changeFrom");
const changeTo = document.getElementById("changeTo");
const addChangeBtn = document.getElementById("addChangeBtn");
const changesList = document.getElementById("changesList");
const ingredientControls = document.querySelector(".ingredient-controls");
const warningsBox = document.getElementById("warnings");
const alertsBox = document.getElementById("alerts");
const loadRecipesBtn = document.getElementById("loadRecipesBtn");
const recipesUrl = document.getElementById("recipesUrl");

/* -------------------------
   ヘルパー関数
   ------------------------- */

function idGen(prefix='id') {
  return prefix + '-' + Math.random().toString(36).slice(2,9);
}

function findRecipeById(id){
  return state.recipesDB.find(r=>r.id===id);
}

function formatNum(n){
  if (Number.isFinite(n)) return Math.round(n*100)/100;
  return n;
}

/* -------------------------
   初期 UI 準備
   ------------------------- */

function populateIngredientPicker(){
  ingredientPicker.innerHTML = "";
  ingredientCandidates.forEach(name=>{
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    ingredientPicker.appendChild(opt);
  });
}
populateIngredientPicker();

function populateCategoryRecipes(){
  // recipe select options based on category selection
  const cat = categorySelect.value;
  const list = state.recipesDB.filter(r=>r.category===cat);
  [recipe1, recipe2, recipe3].forEach(sel=>{
    sel.innerHTML = "";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "-- 未選択 --";
    sel.appendChild(emptyOpt);
    list.forEach(r=>{
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      sel.appendChild(o);
    });
  });
}
categorySelect.addEventListener("change",()=>{
  state.chosen.category = categorySelect.value;
  populateCategoryRecipes();
  computeAll();
});

/* -------------------------
   列の追加 / 削除
   ------------------------- */
addIngredientBtn.addEventListener("click", ()=>{
  const name = ingredientPicker.value;
  if (!name) return alert("食材を選んでください");
  if (state.ingredients.find(i=>i.name===name)){
    alert("既に追加されています");
    return;
  }
  state.ingredients.push({name, initial: 0});
  renderTable();
  computeAll();
});

function removeIngredient(colIndex){
  state.ingredients.splice(colIndex,1);
  renderTable();
  computeAll();
}

/* -------------------------
   ヘルパーの追加 / 表示
   ------------------------- */
addHelperBtn.addEventListener("click", ()=>{
  if (state.helpers.length >= 5) return alert("最大5匹までです");
  const species = helperSpecies.value.trim();
  const level = parseInt(helperLevel.value,10);
  const composition = helperComposition.value.trim();
  const subskill = helperSubskill.value.trim();
  const nickname = helperNickname.value.trim();
  const baseSupply = Number(helperBaseSupply.value) || 0;

  if (!species || !level || !composition || !subskill){
    return alert("種族・レベル・食材構成・サブスキルは必須です");
  }
  const id = idGen('h');
  const p = { id, species, level, composition, subskill, nickname, baseSupply };
  state.helpers.push(p);
  helperSpecies.value = helperLevel.value = helperComposition.value = helperSubskill.value = helperBaseSupply.value = helperNickname.value = "";
  renderHelpers();
  populateHelperSelects();
  computeAll();
});

function renderHelpers(){
  helpersList.innerHTML = "";
  state.helpers.forEach(h=>{
    const li = document.createElement("li");
    li.innerHTML = `<strong>${h.nickname ? h.nickname + " (" + h.species + ")" : h.species}</strong>
      <div>レベル:${h.level} baseSupply:${h.baseSupply} 構成:${h.composition} / サブ:${h.subskill}</div>
      <button data-id="${h.id}" class="removeHelper">削除</button>`;
    helpersList.appendChild(li);
  });

  // 削除ボタン
  document.querySelectorAll(".removeHelper").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const id = e.currentTarget.dataset.id;
      state.helpers = state.helpers.filter(h=>h.id!==id);
      renderHelpers();
      populateHelperSelects();
      computeAll();
    });
  });
}

/* -------------------------
   入れ替え（changes）UI
   ------------------------- */

function populateSlotSelect(){
  changeSlot.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- スロットを選択 --";
  changeSlot.appendChild(defaultOpt);
  slots.forEach((s, idx)=>{
    const opt = document.createElement("option");
    opt.value = idx+1; // +1 因に初期所持は0。それ以降のindexが対応
    opt.textContent = s.label;
    changeSlot.appendChild(opt);
  });
}

function populateHelperSelects(){
  [changeFrom, changeTo].forEach(sel=>{
    sel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "-- 選択 --";
    sel.appendChild(none);
    state.helpers.forEach(h=>{
      const o = document.createElement("option");
      o.value = h.id;
      o.textContent = h.nickname ? `${h.nickname} (${h.species})` : h.species;
      sel.appendChild(o);
    });
  });
  // also populate other places if needed
}
populateSlotSelect();
populateHelperSelects();

addChangeBtn.addEventListener("click", ()=>{
  const slotIndex = Number(changeSlot.value);
  const from = changeFrom.value;
  const to = changeTo.value;
  if (!slotIndex || !from || !to) return alert("スロットと from/to を選んでください");
  state.changes.push({ slotIndex, from, to });
  renderChanges();
  computeAll();
});

function renderChanges(){
  changesList.innerHTML = "";
  state.changes.forEach((c, idx)=>{
    const fromH = state.helpers.find(h=>h.id===c.from);
    const toH = state.helpers.find(h=>h.id===c.to);
    const li = document.createElement("li");
    li.innerHTML = `<div>${slotLabels[c.slotIndex]}: ${fromH ? (fromH.nickname || fromH.species) : c.from} → ${toH ? (toH.nickname || toH.species) : c.to}</div>
      <button data-i="${idx}" class="removeChange">削除</button>`;
    changesList.appendChild(li);
  });
  document.querySelectorAll(".removeChange").forEach(b=>{
    b.addEventListener("click", e=>{
      const i = Number(e.currentTarget.dataset.i);
      state.changes.splice(i,1);
      renderChanges();
      computeAll();
    });
  });
}

/* -------------------------
   レシピ読み込み（外部 or ローカル）
   ------------------------- */

loadRecipesBtn.addEventListener("click", async ()=>{
  const url = recipesUrl.value.trim();
  if (!url) return alert("URL を入力してください");
  warningsBox.textContent = "読み込み中...";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("読み込み失敗");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("データ形式エラー（配列期待）");
    state.recipesDB = data;
    warningsBox.textContent = "読み込み完了";
    populateCategoryRecipes();
    computeAll();
  } catch (e){
    warningsBox.textContent = "読み込みエラー: " + e.message;
  }
});

/* -------------------------
   テーブルの描画
   ------------------------- */
function renderTable(){
  // header: leftmost Time column + ingredient columns (with remove button)
  tableHead.innerHTML = "";
  const tr = document.createElement("tr");
  const thTime = document.createElement("th");
  thTime.textContent = "";
  tr.appendChild(thTime);
  state.ingredients.forEach((ing, idx)=>{
    const th = document.createElement("th");
    const span = document.createElement("span");
    span.textContent = ing.name;
    th.appendChild(span);
    const btn = document.createElement("button");
    btn.textContent = "✖";
    btn.className = "remove-col";
    btn.addEventListener("click", ()=> {
      if (!confirm("この食材列を削除しますか？")) return;
      removeIngredient(idx);
    });
    th.appendChild(btn);
    tr.appendChild(th);
  });
  tableHead.appendChild(tr);

  // body: rows for initial + each slot
  tableBody.innerHTML = "";
  slotLabels.forEach((label, rowIdx)=>{
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = label;
    tdLabel.className = rowIdx === 0 ? "initial-cell" : "";
    tr.appendChild(tdLabel);
    state.ingredients.forEach((ing, colIdx)=>{
      const td = document.createElement("td");
      // initial row should have an input
      if (rowIdx === 0){
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = ing.initial || 0;
        inp.style.width = "90%";
        inp.addEventListener("change", (e)=>{
          ing.initial = Number(e.target.value) || 0;
          computeAll();
        });
        td.appendChild(inp);
      } else {
        td.textContent = ""; // computed value will be set by computeAll
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

/* -------------------------
   計算ロジック
   ------------------------- */
function helperSupplyForSlot(helper, slotIdx){
  // slotIdx: 1..21 (0 is initial)
  // 簡易ロジック: baseSupply * (1 + level/100)
  // 実際のゲームベース値を知りたい場合は wiki 参照して mapping を追加してください。
  const factor = 1 + (helper.level / 100);
  return helper.baseSupply * factor;
}

// get roster for a given slot index (1..21). initial(0) has roster but initial doesn't get helper supplies in that row.
function rosterForSlot(slotIdx){
  // base roster is state.helpers in order added, but maximum 5; if less, use those.
  // apply changes: for each change whose slotIndex <= slotIdx, apply replacements progressively.
  let roster = state.helpers.map(h=>h.id);
  // sort changes by slotIndex ascending
  const changesSorted = [...state.changes].sort((a,b)=>a.slotIndex - b.slotIndex);
  changesSorted.forEach(ch=>{
    if (ch.slotIndex <= slotIdx){
      // replace first occurrence of from with to
      const idx = roster.indexOf(ch.from);
      if (idx !== -1){
        roster[idx] = ch.to;
      } else {
        // if from not present, attempt to append to roster (makes it present)
        // but ensure we don't exceed 5
        if (!roster.includes(ch.to) && roster.length < 5){
          roster.push(ch.to);
        }
      }
    }
  });
  // convert to helper objects
  return roster.map(id => state.helpers.find(h=>h.id===id)).filter(Boolean);
}

function computeAll(){
  // prepare chosen recipes
  state.chosen.recipe1 = recipe1.value;
  state.chosen.recipe2 = recipe2.value;
  state.chosen.recipe3 = recipe3.value;

  // build header/body in case columns changed
  renderTable();

  const rows = slotLabels.length;
  const cols = state.ingredients.length;

  // initialize computed matrix
  state.computed = Array.from({length: rows}, ()=>Array(cols).fill(0));

  // set initial row (row 0)
  state.ingredients.forEach((ing, c)=>{
    state.computed[0][c] = Number(ing.initial) || 0;
  });

  // clear alerts
  alertsBox.innerHTML = "";
  warningsBox.innerHTML = "";

  // check recipe existence for ingredients not in table
  const chosenRecipes = [state.chosen.recipe1, state.chosen.recipe2, state.chosen.recipe3].filter(Boolean).map(findRecipeById);
  // warn if any recipe requires ingredient not in table
  const missingIngredients = new Set();
  chosenRecipes.forEach(r=>{
    if (!r) return;
    for (const ingName of Object.keys(r.consumes)){
      if (!state.ingredients.find(i=>i.name === ingName)){
        missingIngredients.add(ingName);
      }
    }
  });
  if (missingIngredients.size > 0){
    warningsBox.innerHTML = "警告: レシピに表にない食材が含まれています（これらは『無限にある』前提で計算します）: " + Array.from(missingIngredients).join(", ");
  }

  // iterate over rows 1..rows-1 (each timeslot)
  for (let r = 1; r < rows; r++){
    // previous values
    const prev = state.computed[r-1].slice();

    // compute total helper supply for this slot
    const roster = rosterForSlot(r); // r corresponds to slot index in spec (1..21)
    let totalSupplyPerIngredient = {};
    roster.forEach(h=>{
      const supply = helperSupplyForSlot(h, r);
      // We need to distribute supply among ingredients according to helper.composition.
      // Because composition is free-text, we'll use a simple heuristic:
      // - If helper.composition includes an ingredient name substring, assign to that ingredient.
      // - Else, distribute equally among currently listed ingredients.
      let assigned = false;
      state.ingredients.forEach(ing=>{
        if (h.composition && h.composition.includes(ing.name)){
          totalSupplyPerIngredient[ing.name] = (totalSupplyPerIngredient[ing.name]||0) + supply;
          assigned = true;
        }
      });
      if (!assigned){
        // distribute equally
        const share = supply / Math.max(1, state.ingredients.length);
        state.ingredients.forEach(ing=>{
          totalSupplyPerIngredient[ing.name] = (totalSupplyPerIngredient[ing.name]||0) + share;
        });
      }
    });

    // Now try to determine which recipe to apply at this slot according to rule:
    // try recipe1, if any ingredient becomes negative then try recipe2, then recipe3.
    // if none of them works, apply recipe1 resulting negative.
    // If a recipe requires ingredient not in table -> treat as infinite (do not make negative).
    let chosenRecipe = null;
    const candidateRecipes = [state.chosen.recipe1, state.chosen.recipe2, state.chosen.recipe3].filter(Boolean).map(findRecipeById);
    // helper: check if applying recipe r would make any ingredient negative
    function wouldCauseNegative(candidate){
      if (!candidate) return false;
      // compute temp values after supply and consumption
      for (let c=0; c<cols; c++){
        const name = state.ingredients[c].name;
        const after = prev[c] + (totalSupplyPerIngredient[name] || 0);
        const consume = (candidate.consumes[name] || 0);
        const final = after - consume;
        if (final < 0) return true;
      }
      return false;
    }
    // pick first candidate that does NOT cause negative
    for (const cand of candidateRecipes){
      if (!cand) continue;
      if (!wouldCauseNegative(cand)){
        chosenRecipe = cand;
        break;
      }
    }
    if (!chosenRecipe && candidateRecipes.length>0){
      // none avoided negative -> use recipe1 (if exists) and allow negatives
      chosenRecipe = candidateRecipes[0] || null;
    }

    // Now compute the row values
    for (let c=0; c<cols; c++){
      const name = state.ingredients[c].name;
      const supply = totalSupplyPerIngredient[name] || 0;
      const consume = chosenRecipe ? (chosenRecipe.consumes[name] || 0) : 0;
      state.computed[r][c] = prev[c] + supply - consume;
    }
  }

  // Put computed values into table
  // (tableBody rows correspond to slotLabels length)
  const trRows = tableBody.querySelectorAll("tr");
  for (let r=0; r<slotLabels.length; r++){
    const tds = trRows[r].querySelectorAll("td");
    // skip tds[0] (label), tds[1...] are ingredient cells
    for (let c=0; c<state.ingredients.length; c++){
      const cell = tds[c+1];
      // initial row (r==0) already has input
      if (r === 0){
        // nothing
      } else {
        cell.textContent = formatNum(state.computed[r][c]);
        // highlight negatives
        if (state.computed[r][c] < 0) cell.style.color = "#b00";
        else cell.style.color = "";
      }
    }
  }

  // show roster summary and per-helper supplies per slot in alertsBox
  alertsBox.innerHTML = "";
  for (let r=1; r<slotLabels.length; r++){
    const roster = rosterForSlot(r);
    const supplies = roster.map(h => {
      const s = helperSupplyForSlot(h, r);
      return `${h.nickname ? h.nickname : h.species}: ${formatNum(s)}`;
    }).join(" / ");
    const div = document.createElement("div");
    div.textContent = `${slotLabels[r]} → ${supplies || "(no helpers)"}`;
    alertsBox.appendChild(div);
  }
}

/* -------------------------
   初期レンダリング
   ------------------------- */
function init(){
  // populate recipe selects initially
  populateCategoryRecipes();
  renderTable();
  renderHelpers();
  renderChanges();
  computeAll();
  // wire recipe select changes
  [recipe1, recipe2, recipe3].forEach(rsel=>{
    rsel.addEventListener("change", computeAll);
  });
}

init();

/* -------------------------
   その他: テスト用にいくつかの食材を追加しておく（コメントアウト可）
   ------------------------- */
// state.ingredients.push({name: "あじわいキノコ", initial: 100});
// state.ingredients.push({name: "とくせんエッグ", initial: 300});
// renderTable();
// computeAll();
