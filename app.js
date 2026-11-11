(() => {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  const $ = id => document.getElementById(id);
  const bots = [
    ['Maya “The Architect”', 840, 'Positional · Patient · Precise', '🧠', 'purple'],
    ['Theo “The Gambler”', 610, 'Tactical · Bold · Unpredictable', '🎲', 'yellow'],
    ['Juniper “The Gardener”', 720, 'Calm · Organic · Quiet', '🌿', 'mint'],
    ['Rex “The Challenger”', 1020, 'Aggressive · Direct · Fearless', '🔥', 'red'],
    ['Pip “The Trickster”', 550, 'Playful · Sneaky · Quick', '🦊', 'orange'],
    ['Otto “The Professor”', 1170, 'Classical · Exact · Scholarly', '📚', 'blue'],
    ['Nia “The Night Owl”', 930, 'Creative · Patient · Mysterious', '🌙', 'indigo'],
    ['Sol “The Minimalist”', 760, 'Simple · Clean · Efficient', '☀️', 'sun'],
    ['Cleo “The Composer”', 1090, 'Elegant · Patterned · Expressive', '🎼', 'pink'],
    ['Max “The Sprinter”', 680, 'Fast · Sharp · Restless', '⚡', 'blue'],
    ['Ari “The Storyteller”', 880, 'Imaginative · Warm · Witty', '✍️', 'green'],
    ['Vera “The Endgame”', 1240, 'Endgame · Tough · Relentless', '♟', 'slate']
  ];
  const initial = [['r','n','b','q','k','b','n','r'], Array(8).fill('p'), ...Array.from({length: 4}, () => Array(8).fill('')), Array(8).fill('P'), ['R','N','B','Q','K','B','N','R']];
  let state, selected = null, history = [], activeBot = 0, thinking = false;

  const art = (side, type) => {
    const dark = side === 'b'; const fill = dark ? '#292832' : '#fffaf1'; const stroke = dark ? '#12121a' : '#765247';
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"`;
    const base = `<path ${common} d="M12 72h56M18 66h44l-4-7H22z"/>`;
    const shapes = {
      p: `<path ${common} d="M31 20c0 5 3 8 7 10-1 5-7 9-9 18h26c-2-9-8-13-9-18 4-2 7-5 7-10-1-6-5-9-11-9s-10 3-11 9Z"/>`,
      n: `<path ${common} d="M23 62c1-11 2-18 8-25-3-9 1-19 13-25l-3 10c10 1 16 7 17 17-5-4-10-5-13-3 3 6 4 14 4 26H23Z"/><path d="M45 25h.1" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>`,
      b: `<path ${common} d="M31 61c0-8 6-15 9-22-4-5-6-10-5-16 1-6 5-11 5-14 0 3 4 8 5 14 1 6-1 11-5 16 3 7 9 14 9 22H31Z"/><path d="M38 18l5 6" stroke="${stroke}" stroke-width="2.5"/>`,
      r: `<path ${common} d="M25 17h8v6h5v-6h8v6h5v-6h4l-3 16-3 5c-1 6-1 13 4 23H24c5-10 5-17 4-23l-3-5-3-16h3Z"/>`,
      q: `<path ${common} d="M20 62h40l-4-24-8 8-8-23-8 23-8-8-4 24Z"/><path ${common} d="M25 18a4 4 0 1 0 0 .1M40 13a4 4 0 1 0 0 .1M55 18a4 4 0 1 0 0 .1"/>`,
      k: `<path ${common} d="M34 16h12M40 10v13M29 27h22l-4 11c-1 4-1 8 5 24H28c6-16 6-20 5-24l-4-11Z"/>`
    };
    return `<svg class="piece-art" viewBox="0 0 80 80" aria-hidden="true">${base}${shapes[type]}</svg>`;
  };
  function cloneBoard(b) { return b.map(row => row.slice()); }
  function reset() { state = { board: cloneBoard(initial), turn: 'w', castle: {K:true,Q:true,k:true,q:true}, ep: null, result: null }; selected = null; history = []; thinking = false; render(); renderMoves(); updateTurn(); }
  function sideOf(p) { return p && (p === p.toUpperCase() ? 'w' : 'b'); }
  function snapshot() { return { board: cloneBoard(state.board), turn: state.turn, castle: {...state.castle}, ep: state.ep, result: state.result }; }
  function restore(s, silent=false) { state = {board: cloneBoard(s.board), turn:s.turn, castle:{...s.castle}, ep:s.ep, result:s.result}; if (!silent) { selected=null; render(); renderMoves(); updateTurn(); } }
  function inside(r,c) { return r>=0 && r<8 && c>=0 && c<8; }
  function attacked(r,c,by) {
    const b=state.board, pawn=by==='w'?'P':'p', pr=by==='w'?r+1:r-1;
    for (const dc of [-1,1]) if (inside(pr,c+dc)&&b[pr][c+dc]===pawn) return true;
    const knight=by==='w'?'N':'n'; for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) if (inside(r+dr,c+dc)&&b[r+dr][c+dc]===knight) return true;
    const king=by==='w'?'K':'k'; for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inside(r+dr,c+dc)&&b[r+dr][c+dc]===king)return true;
    for (const [dr,dc,types] of [[-1,0,'rq'],[1,0,'rq'],[0,-1,'rq'],[0,1,'rq'],[-1,-1,'bq'],[-1,1,'bq'],[1,-1,'bq'],[1,1,'bq']]) { let rr=r+dr,cc=c+dc; while(inside(rr,cc)){const p=b[rr][cc]; if(p){if(sideOf(p)===by&&types.includes(p.toLowerCase()))return true;break}rr+=dr;cc+=dc;} }
    return false;
  }
  function inCheck(side) { let kr=-1,kc=-1; const k=side==='w'?'K':'k'; state.board.forEach((row,r)=>row.forEach((p,c)=>{if(p===k){kr=r;kc=c;}})); return kr<0 || attacked(kr,kc,side==='w'?'b':'w'); }
  function pseudo(side) {
    const b=state.board, out=[]; const add=(r,c,tr,tc,extra={})=>{if(!inside(tr,tc))return;const target=b[tr][tc];if(target&&sideOf(target)===side)return;if(target&&target.toLowerCase()==='k')return;out.push({from:[r,c],to:[tr,tc],piece:b[r][c],capture:target||'',...extra});};
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(!p||sideOf(p)!==side)continue;const k=p.toLowerCase();
      if(k==='p'){const dir=side==='w'?-1:1,start=side==='w'?6:1;if(inside(r+dir,c)&&!b[r+dir][c]){add(r,c,r+dir,c);if(r===start&&!b[r+2*dir][c])add(r,c,r+2*dir,c,{double:true});}for(const dc of [-1,1]){const tr=r+dir,tc=c+dc;if(!inside(tr,tc))continue;if(b[tr][tc]&&sideOf(b[tr][tc])!==side)add(r,c,tr,tc);if(state.ep&&state.ep[0]===tr&&state.ep[1]===tc)add(r,c,tr,tc,{enPassant:true,capture:side==='w'?'p':'P'});}}
      if(k==='n')for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r,c,r+dr,c+dc);
      if('brq'.includes(k)){const dirs=[];if('bq'.includes(k))dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);if('rq'.includes(k))dirs.push([-1,0],[1,0],[0,-1],[0,1]);for(const [dr,dc] of dirs){let tr=r+dr,tc=c+dc;while(inside(tr,tc)){const before=out.length;add(r,c,tr,tc);if(before===out.length||b[tr][tc])break;tr+=dr;tc+=dc;}}}
      if(k==='k'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc)add(r,c,r+dr,c+dc);const row=side==='w'?7:0,enemy=side==='w'?'b':'w'; if(r===row&&c===4&&!inCheck(side)){if(state.castle[side==='w'?'K':'k']&&b[row][7]===(side==='w'?'R':'r')&&!b[row][5]&&!b[row][6]&&!attacked(row,5,enemy)&&!attacked(row,6,enemy))add(r,c,row,6,{castle:'king'});if(state.castle[side==='w'?'Q':'q']&&b[row][0]===(side==='w'?'R':'r')&&!b[row][1]&&!b[row][2]&&!b[row][3]&&!attacked(row,3,enemy)&&!attacked(row,2,enemy))add(r,c,row,2,{castle:'queen'});}}
    } return out;
  }
  function apply(m) { const b=state.board,[sr,sc]=m.from,[tr,tc]=m.to;const p=b[sr][sc];b[tr][tc]=p;b[sr][sc]='';if(m.enPassant)b[tr+(state.turn==='w'?1:-1)][tc]='';if(m.castle){const row=state.turn==='w'?7:0;if(m.castle==='king'){b[row][5]=b[row][7];b[row][7]='';}else{b[row][3]=b[row][0];b[row][0]='';}}if(p.toLowerCase()==='p'&&(tr===0||tr===7))b[tr][tc]=state.turn==='w'?'Q':'q';const s=state.turn;if(p.toLowerCase()==='k'){state.castle[s==='w'?'K':'k']=false;state.castle[s==='w'?'Q':'q']=false;}if(p.toLowerCase()==='r'){if(sr===7&&sc===0)state.castle.Q=false;if(sr===7&&sc===7)state.castle.K=false;if(sr===0&&sc===0)state.castle.q=false;if(sr===0&&sc===7)state.castle.k=false;}if(m.capture.toLowerCase()==='r'){if(tr===7&&tc===0)state.castle.Q=false;if(tr===7&&tc===7)state.castle.K=false;if(tr===0&&tc===0)state.castle.q=false;if(tr===0&&tc===7)state.castle.k=false;}state.ep=m.double?[ (sr+tr)/2, sc ]:null;state.turn=s==='w'?'b':'w';}
  function legalMoves(side){const saved=snapshot(),out=[];for(const m of pseudo(side)){apply(m);if(!inCheck(side))out.push(m);restore(saved,true)}return out;}
  function moveFor(r,c,tr,tc){return legalMoves('w').find(m=>m.from[0]===r&&m.from[1]===c&&m.to[0]===tr&&m.to[1]===tc);}
  function finish(){const moves=legalMoves(state.turn);if(!moves.length){state.result=inCheck(state.turn)?(state.turn==='w'?'Bot wins by checkmate':'You win by checkmate'):'Draw by stalemate';return true}return false;}
  function makeMove(m,bot=false){if(!m||((state.board[m.to[0]][m.to[1]]||'').toLowerCase()==='k'))return;history.push(snapshot());apply(m);if(!finish()&&!bot){thinking=true;updateTurn();setTimeout(botMove,520)}render();renderMoves();updateTurn();}
  function botMove(){if(state.result){thinking=false;return}const moves=legalMoves('b');if(!moves.length){finish();thinking=false;render();updateTurn();return}moves.sort((a,b)=>(b.capture?1:0)-(a.capture?1:0));makeMove(moves[Math.floor(Math.random()*Math.min(7,moves.length))],true);thinking=false;render();renderMoves();updateTurn();}
  function clickSquare(r,c){if(thinking||state.result)return;const p=state.board[r][c];if(selected){const m=moveFor(selected[0],selected[1],r,c);if(m){makeMove(m);selected=null;return}selected=null;}if(p&&sideOf(p)==='w')selected=[r,c];render();}
  function render(){const b=state.board,moves=selected?legalMoves('w').filter(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]):[];boardEl.innerHTML='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){const sq=document.createElement('button');sq.className='square '+((r+c)%2?'dark':'light');if(selected&&selected[0]===r&&selected[1]===c)sq.classList.add('selected');const m=moves.find(x=>x.to[0]===r&&x.to[1]===c);if(m)sq.classList.add(m.capture?'capture':'legal');const p=b[r][c];if(p)sq.innerHTML=art(sideOf(p),p.toLowerCase());sq.onclick=()=>clickSquare(r,c);boardEl.appendChild(sq);}}
  function renderMoves(){const el=$('moves');$('moveCount').textContent=history.length+' MOVES';if(!history.length){el.innerHTML='<div class="move"><span>—</span><span>Waiting for your first move</span></div>';return}el.innerHTML=history.slice(-6).map((s,i)=>'<div class="move"><span>'+String(Math.max(1,history.length-5+i)).padStart(2,'0')+'</span><b>Move '+(Math.max(1,history.length-5+i))+'</b><span class="current">played</span></div>').join('')}
  function updateTurn(){const t=$('turnText');if(state.result){t.innerHTML='<strong>'+state.result+'</strong>';return}t.innerHTML=thinking?'<strong>'+bots[activeBot][0].split(' ')[0]+' is thinking…</strong> · Black pieces':'<strong>Your turn</strong> · White pieces'+(inCheck('w')?' · Check!':'')}
  function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1900)}
  function selectBot(i){activeBot=i;const b=bots[i];$('selectedName').textContent=b[0];$('selectedStyle').textContent=b[2];$('selectedFace').textContent=b[3];$('selectedFace').className='bot-face face-'+b[4];renderBots();reset();toast('Playing '+b[0])}
  function renderBots(){const list=$('botList');list.innerHTML=bots.map((b,i)=>'<button class="bot-item '+(i===activeBot?'active':'')+'" data-i="'+i+'"><i class="bot-face face-'+b[4]+'">'+b[3]+'</i><span class="bot-copy"><strong>'+b[0]+'</strong><small>'+b[2]+'</small></span><span class="elo">'+b[1]+'</span></button>').join('');list.querySelectorAll('.bot-item').forEach(x=>x.onclick=()=>selectBot(+x.dataset.i))}
  $('newBtn').onclick=()=>{reset();toast('New game started')};$('undoBtn').onclick=()=>{if(history.length>=2){const s=history[history.length-2];history.splice(-2);restore(s);toast('Last turn undone')}};$('randomBtn').onclick=()=>selectBot(Math.floor(Math.random()*bots.length));
  const style=document.createElement('style');style.textContent='.piece-art{width:78%;height:78%;filter:drop-shadow(0 3px 1px rgba(41,26,20,.25));}';document.head.appendChild(style);renderBots();reset();
})();

const guide = document.createElement('section');
guide.className = 'card';
guide.innerHTML = '<div class="card-title"><h2>How to play</h2><span>QUICK GUIDE</span></div><div class="instruction-list"><div class="instruction"><b>1</b><span>Choose an opponent from the list.</span></div><div class="instruction"><b>2</b><span>Click one of your white pieces, then click a highlighted square.</span></div><div class="instruction"><b>3</b><span>Your opponent moves automatically.</span></div><div class="instruction"><b>4</b><span>Use Undo to take back a turn or New game to restart.</span></div></div>';
document.querySelector('.right-col')?.prepend(guide);

const themeStyle = document.createElement('style');
themeStyle.textContent = `
  body[data-theme="aurora"]{background:radial-gradient(circle at 8% 0%,#e6dfff 0,transparent 32%),radial-gradient(circle at 92% 8%,#cff8e8 0,transparent 30%),linear-gradient(135deg,#f8f4ff 0%,#eef8ff 52%,#fff5e8 100%);}
  body[data-theme="sunset"]{background:radial-gradient(circle at 12% 8%,#ffd3a8 0,transparent 30%),radial-gradient(circle at 92% 0%,#ffc7dc 0,transparent 34%),linear-gradient(135deg,#fff3df 0%,#ffe9f1 52%,#f0e8ff 100%);}
  body[data-theme="ocean"]{background:radial-gradient(circle at 12% 0%,#bfeeff 0,transparent 34%),radial-gradient(circle at 92% 18%,#c9f7eb 0,transparent 32%),linear-gradient(135deg,#e8f8ff 0%,#e8f5ff 52%,#e8fff7 100%);}
  body[data-theme="berry"]{background:radial-gradient(circle at 10% 6%,#e8c8ff 0,transparent 34%),radial-gradient(circle at 92% 8%,#ffc6d8 0,transparent 32%),linear-gradient(135deg,#f8ecff 0%,#f0e9ff 52%,#fff0f4 100%);}
  .theme-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.theme-option{border:1px solid var(--line);border-radius:11px;padding:8px 4px;background:#fff;color:var(--ink);font-size:10px;font-weight:800}.theme-option i{display:block;height:28px;border-radius:7px;margin-bottom:6px}.theme-option.active{border-color:var(--purple);box-shadow:0 0 0 2px var(--purple-soft)}.swatch-aurora{background:linear-gradient(135deg,#d8c8ff,#bff4df)}.swatch-sunset{background:linear-gradient(135deg,#ffc88f,#f8b8d2)}.swatch-ocean{background:linear-gradient(135deg,#aee8ff,#b9f0dc)}.swatch-berry{background:linear-gradient(135deg,#dfb8ff,#ffb8cf)}
`;
document.head.appendChild(themeStyle);

const picker = document.createElement('section');
picker.className = 'card';
picker.innerHTML = '<div class="card-title"><h2>Choose a background</h2><span>STYLE</span></div><div class="theme-picker"><button class="theme-option" data-theme="aurora"><i class="swatch-aurora"></i>Aurora</button><button class="theme-option" data-theme="sunset"><i class="swatch-sunset"></i>Sunset</button><button class="theme-option" data-theme="ocean"><i class="swatch-ocean"></i>Ocean</button><button class="theme-option" data-theme="berry"><i class="swatch-berry"></i>Berry</button></div>';
document.querySelector('.right-col')?.prepend(picker);

function applyTheme(theme){
  document.body.dataset.theme=theme;
  localStorage.setItem('humanish-theme',theme);
  picker.querySelectorAll('.theme-option').forEach(button=>button.classList.toggle('active',button.dataset.theme===theme));
}
picker.querySelectorAll('.theme-option').forEach(button=>button.onclick=()=>applyTheme(button.dataset.theme));
applyTheme(localStorage.getItem('humanish-theme')||'aurora');

const nav = document.querySelector('.nav');
const clubNav = document.createElement('button');
clubNav.innerHTML = '<span>♧</span><span>Club</span>';
nav?.append(clubNav);

const navTargets = {
  Play: document.querySelector('.board-card'),
  'My games': document.querySelector('#moves')?.closest('.card'),
  Challenges: document.querySelector('.bot-card'),
  Leaderboard: document.querySelector('.right-col .card'),
  Club: document.querySelector('.side-bottom')
};

function activateNav(label, button){
  nav?.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));
  const target=navTargets[label];
  target?.scrollIntoView({behavior:'smooth',block:'start'});
}

nav?.querySelectorAll('button').forEach(button=>{
  const label=button.querySelector('span:last-child')?.textContent.trim()||button.textContent.trim();
  button.type='button';
  button.onclick=()=>activateNav(label,button);
});

const clubIcon=document.querySelector('.icon-btn');
clubIcon?.addEventListener('click',()=>activateNav('Club',clubNav));

document.querySelector('.sidebar')?.remove();
document.querySelector('.app')?.style.setProperty('grid-template-columns','1fr','important');
