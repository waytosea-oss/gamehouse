/* Original rules. Shared pure state machine: browser + Node. No network. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Tide=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KEY='tide_three_days_r4_v1', MANUAL=KEY+'_manual';
const goods={tape:{name:'防水胶带',price:25,desc:'交给顾遥修复外送保温箱。'},meal:{name:'热饭便当',price:18,desc:'行动力 +2，压力 −8。'},tea:{name:'乌龙茶',price:12,desc:'压力 −18。'},book:{name:'沟通手册',price:30,desc:'阅读消耗 1 行动力，表达 +1。'}};
function fresh(){return {v:1,day:1,ap:12,cash:60,wages:0,stress:12,fitness:1,charm:1,bag:{meal:1},found:false,trainDay:0,mirrorDay:0,workToday:0,workWins:0,workSeq:0,pending:null,settled:[],q:{cafe:0,dock:0,branch:null},rel:{gu:0,lu:0},seen:{},messages:['房东：第三天睡前结清 240 元押金，房间就给你留着。','陆川：码头招临时工。来了先试一班，工资隔天到账。'],log:['抵达栖湾，口袋里有 60 元。'],ending:null};}
function fail(msg){return {ok:false,error:msg};}
function step(s,a){
 if(!s||s.v!==1)return fail('存档版本不匹配。');
 let n=JSON.parse(JSON.stringify(s)), text='';
 if(n.ending && !['seen'].includes(a.type))return fail('这一程已结束。可以读档或新开一局。');
 const spend=(ap=0,cash=0)=>{if(n.ap<ap)throw Error('行动力不足，需要 '+ap+' 点。回房睡觉或使用便当。');if(n.cash<cash)throw Error('零钱不足，需要 ¥'+cash+'。工资在睡眠后到账。');n.ap-=ap;n.cash-=cash;};
 const stress=d=>n.stress=Math.max(0,Math.min(100,n.stress+d));
 try{switch(a.type){
 case 'find':if(n.found)throw Error('抽屉已经找过了。');n.found=true;n.cash+=15;n.bag.tea=(n.bag.tea||0)+1;text='翻出搬家时留下的 ¥15 和一瓶乌龙茶。';break;
 case 'train':if(n.trainDay===n.day)throw Error('今天已经训练过，明天再继续。');spend(2);n.trainDay=n.day;n.fitness++;stress(5);text='体能 +1，行动力 −2，压力 +5。体能达到 2，吊装区加宽。';break;
 case 'mirror':if(n.mirrorDay===n.day)throw Error('今天已经练习过表达。');spend(1);n.mirrorDay=n.day;n.charm++;stress(-3);text='对着镜子练习自我介绍。表达 +1，行动力 −1，压力 −3。';break;
 case 'walk':spend(1);stress(-15);text='沿江走了一段，行动力 −1，压力 −15。';break;
 case 'buy':{let g=Object.hasOwn(goods,a.item)?goods[a.item]:null;if(!g)throw Error('没有这种商品。');spend(0,g.price);n.bag[a.item]=(n.bag[a.item]||0)+1;text='购入'+g.name+'，现金 −'+g.price+'。';break;}
 case 'use':{if(!(n.bag[a.item]>0))throw Error('背包里没有这件物品。');if(a.item==='meal'){if(n.ap===12&&n.stress===0)throw Error('现在不需要补充，先留着便当。');n.ap=Math.min(12,n.ap+2);stress(-8);text='吃完便当，行动力 +2（上限 12），压力 −8。';}else if(a.item==='tea'){stress(-18);text='喝下乌龙茶，压力 −18。';}else if(a.item==='book'){spend(1);n.charm++;text='读完手册，表达 +1，行动力 −1。';}else throw Error('这是任务用品，请带去小馆交付。');n.bag[a.item]--;break;}
 case 'cafeAccept':if(n.q.cafe!==0)throw Error('已经聊过这件事。');n.q.cafe=1;n.rel.gu++;n.messages.push('顾遥：第二天结束前带卷防水胶带来吧，杂货亭有卖。第三天想请你帮忙出摊。');text='接下「一盏热灯」：在第 2 天结束前交付防水胶带。';break;
 case 'cafeDeliver':if(n.q.cafe!==1)throw Error('当前没有待交付的胶带。');if(n.day>2)throw Error('修箱的期限已过。');if(!n.bag.tape)throw Error('缺少防水胶带，可在杂货亭花 ¥25 购买。');spend(1);n.bag.tape--;n.q.cafe=2;n.rel.gu+=2;n.messages.push('顾遥：箱子修好了！第三天来小馆，一起准备开摊。');text='交付胶带，行动力 −1，顾遥信任 +2。第三天回来帮忙。';break;
 case 'cafeHelp':if(n.q.cafe!==2||n.day!==3)throw Error('需要第三天、并已交付胶带。');if(n.charm<2&&n.rel.gu<3)throw Error('需要表达 2 或顾遥信任 3。');spend(2);n.q.cafe=3;n.rel.gu+=2;n.cash+=60;stress(-10);text='帮忙开摊，现金 +60，顾遥信任 +2，行动力 −2，压力 −10。';break;
 case 'cafeSell':if(![1,2].includes(n.q.cafe))throw Error('这条分支已经关闭。');spend(1);n.q.cafe=4;n.cash+=80;n.rel.gu=-2;n.messages.push('顾遥：供应商说有人把我的配方清单卖给了隔壁。往后不必来了。');text='把供货线索卖给同行。现金 +80，行动力 −1。顾遥关闭了合作。';break;
 case 'dockAccept':if(n.q.dock!==0)throw Error('已经接过这份试工。');n.q.dock=1;n.rel.lu++;text='接下「有回音的工作」：先完成一次达标吊装。';break;
 case 'dockReview':if(n.q.dock!==1||n.workWins<1)throw Error('先完成一班达标吊装，再找陆川。');n.q.dock=2;n.rel.lu++;text='试工通过，陆川信任 +1。第 2 天起回来核对破损记录。';break;
 case 'dockReport':case 'dockHide':if(n.q.dock!==2||n.day<2)throw Error('第二天起，试工通过后才可处理破损记录。');spend(1);n.q.dock=3;n.q.branch=a.type==='dockReport'?'report':'hide';if(n.q.branch==='report'){n.cash+=30;n.rel.lu+=2;text='登记破损，领取核对补贴 ¥30。行动力 −1，陆川信任 +2。';n.messages.push('陆川：登记我看过了。再完成一班，第三天给你写推荐。');}else {n.cash+=70;n.rel.lu-=2;text='收下封口费 ¥70，行动力 −1，陆川信任 −2。推荐机会关闭。';n.messages.push('陆川：破损记录没了，你应该知道是怎么回事。推荐信的事先算了。');}break;
 case 'dockFinish':if(n.day!==3||n.q.dock!==3||n.q.branch!=='report'||n.workWins<2)throw Error('推荐需要：第 3 天、如实登记、累计两班达标。');n.q.dock=4;n.cash+=60;n.rel.lu+=2;text='陆川递来推荐信和 ¥60 岗位补贴。信任 +2。';break;
 case 'startWork':if(n.pending)throw Error('有一班未结算，请先继续。');if(n.workToday>=2)throw Error('每日最多两班。明天再来。');if(n.stress>=90)throw Error('压力达到 90，先喝茶或沿江散步再上工。');spend(3);n.workToday++;n.workSeq++;n.pending={id:n.workSeq,day:n.day,retry:0};text='开始第 '+n.workToday+' 班，行动力 −3。离开或刷新后可免费重开此班。';break;
 case 'retryWork':if(!n.pending||n.pending.retry>=1)throw Error('本班免费重试已用完。');n.pending.retry++;text='同一班再试一次，行动力不重复扣除。';break;
 case 'finishWork':{if(!n.pending||n.pending.id!==a.id||n.settled.includes(a.id))throw Error('这班已经结算或不存在。');let hits=Number(a.hits);if(!Number.isInteger(hits)||hits<0||hits>6)throw Error('无效吊装成绩。');let target=n.pending.day===1?3:4,win=hits>=target;let pay=win?70+hits*10:20+hits*10;n.wages+=pay;if(win)n.workWins++;stress(win?12:18);n.settled.push(a.id);n.pending=null;text=(win?'吊装达标':'本班未达标')+'，待发工资 +'+pay+'，压力 +'+(win?12:18)+'。睡眠后转入现金。';break;}
 case 'sleep':if(n.pending)throw Error('请先回码头结算未完成的班次。');{let paid=n.wages;n.cash+=paid;n.wages=0;if(n.day===3){n.ending=n.cash<240?'dawn':n.q.cafe===3&&n.q.dock===4?'harbor':'footing';text='第三天结算：工资到账 ¥'+paid+'。'+(n.cash>=240?'押金 ¥240 已支付。':'押金仍有缺口。');if(n.cash>=240)n.cash-=240;}else{n.day++;n.ap=12;stress(-30);n.workToday=0;if(n.day===3&&n.q.cafe===1){n.q.cafe=5;n.messages.push('顾遥：胶带等不到，我先找别人修了。谢谢你的心意。');}n.messages.push(n.day===2?'陆川：今天有一份破损记录需要核对，试工通过就来找我。':'房东：今晚是押金期限。睡前的待发工资也算入结算。');text='第 '+n.day+' 天。工资 ¥'+paid+' 到账，行动力恢复至 12，压力 −30。';}}break;
 case 'seen':if(!['cafe','dock','bridge','alley'].includes(a.id))throw Error('无效片段。');n.seen[a.id]=true;return {ok:true,state:n,text:''};
 default:throw Error('未知行动。');}
 }catch(e){return fail(e.message)}
 n.log.push('第'+n.day+'天 · '+text);n.log=n.log.slice(-40);return {ok:true,state:n,text};
}
function encode(s){return JSON.stringify({tag:KEY,state:s});}
function decode(raw){try{const x=JSON.parse(raw),s=x.state;if(x.tag!==KEY||!s||s.v!==1||![1,2,3].includes(s.day))return null;const nums=['ap','cash','wages','stress','fitness','charm','workToday','workWins','workSeq'];if(nums.some(k=>!Number.isFinite(s[k])||s[k]<0))return null;if(s.ap>12||s.stress>100||!s.q||!s.bag||!s.rel||!s.seen||!Array.isArray(s.messages)||!Array.isArray(s.log)||!Array.isArray(s.settled))return null;if(![0,1,2,3,4,5].includes(s.q.cafe)||![0,1,2,3,4].includes(s.q.dock)||![null,'report','hide'].includes(s.q.branch))return null;if(!['gu','lu'].every(k=>Number.isFinite(s.rel[k])))return null;if(Object.entries(s.bag).some(([k,v])=>!goods[k]||!Number.isInteger(v)||v<0))return null;if(s.pending&&(!Number.isInteger(s.pending.id)||s.pending.id<1||![1,2,3].includes(s.pending.day)||![0,1].includes(s.pending.retry)))return null;if(![null,'harbor','footing','dawn'].includes(s.ending))return null;return s;}catch(_){return null;}}
function craneTarget(day,seed,time){return day===3?360+Math.sin(time*.75+seed)*85:360;}
function craneWidth(day,fitness){return (day===1?170:day===2?140:115)+(fitness>=2?24:0);}
function craneHit(x,day,fitness,seed,time){return Math.abs(x-craneTarget(day,seed,time))<craneWidth(day,fitness)/2-18;}
// Runtime practice/physics is separate from the persistent economy and quests.
function makeCrane(day,fitness,seed,mode='practice'){
 return {day,fitness,seed,mode,phase:'aim',x:80,dir:1,t:0,time:day===1?36:day===2?33:30,hits:0,shots:0,attempts:0,crate:null,paused:false,result:false,done:false,ready:false,feedback:mode==='practice'?'练习不限时：对准金色托盘，点击放箱。':'正式计时开始：六箱一班。'};
}
function dropCrane(w){if(!w||w.paused||w.result||w.done||w.ready||w.phase!=='aim')return false;w.crate={x:w.x,y:120,vy:0};w.phase='fall';if(w.mode==='timed')w.shots++;else w.attempts++;return true;}
function tickCrane(w,delta){
 if(!w||w.paused||w.result||w.done||w.ready)return null;
 const dt=Math.max(0,Math.min(delta,.05));w.t+=dt;let event=null;
 if(w.mode==='timed')w.time=Math.max(0,w.time-dt);
 if(w.phase==='aim'){w.x+=w.dir*dt*(w.day===1?230:w.day===2?290:330);if(w.x>650){w.x=650;w.dir=-1}if(w.x<70){w.x=70;w.dir=1}}
 else if(w.phase==='fall'){w.crate.vy+=dt*1100;w.crate.y+=w.crate.vy*dt;if(w.crate.y>=400){const hit=craneHit(w.crate.x,w.day,w.fitness,w.seed,w.t),offset=w.crate.x-craneTarget(w.day,w.seed,w.t);w.crate.hit=hit;event=hit?'hit':'miss';if(hit){if(w.mode==='timed')w.hits++;else w.ready=true;w.feedback=w.mode==='practice'?'练习接住了！准备好后，自主开始正式计时。':'接住一箱 · '+w.hits+' 箱已稳放';}else{w.feedback='落点偏'+(offset<0?'左':'右')+'，整箱未进入金区。'+(w.day===3?'托盘在移动，给下落留提前量。':'箱子竖直下落，对准金区再放。');}w.phase='wait';w.wait=.5;}}
 else if(w.phase==='wait'){w.wait-=dt;if(w.wait<=0){w.crate=null;w.phase='aim';w.x=w.dir>0?70:650;if(w.mode==='timed'&&w.shots>=6)w.done=true;}}
 if(w.mode==='timed'&&w.time<=0)w.done=true;
 return event;
}
function beginTimedWork(s,practice){
 if(!practice||practice.mode!=='practice'||!practice.ready)return fail('请先亲手接住一箱，再开始正式计时。');
 let r=s.pending?{ok:true,state:s,text:'恢复已付行动的班次。'}:step(s,{type:'startWork'});
 if(!r.ok)return r;
 return {...r,work:makeCrane(r.state.pending.day,r.state.fitness,r.state.pending.id,'timed')};
}

return {KEY,MANUAL,goods,fresh,step,encode,decode,craneTarget,craneWidth,craneHit,makeCrane,dropCrane,tickCrane,beginTimedWork};
});
