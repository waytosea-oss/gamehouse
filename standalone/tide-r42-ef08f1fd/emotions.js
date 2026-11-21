/* Pure presentation mapping. Never changes economy, tasks, scores or save data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TideEmotion=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function lastPerformance(s){for(const line of [...s.log].reverse()){if(/^第\d天 · 吊装达标，/.test(line))return 'win';if(/^第\d天 · 本班未达标，/.test(line))return 'miss';}return null;}
 function base(s,who){if(!s)return 'neutral';if(who==='gu'){if(s.q.cafe===4)return 'angry';if(s.q.cafe===5)return 'cold';if(s.q.cafe===3||s.rel.gu>=3)return 'warm';return s.rel.gu<=1?'cold':'neutral';}if(s.q.branch==='hide')return 'angry';if(s.q.dock===4||s.rel.lu>=3)return 'warm';const result=lastPerformance(s);if(result==='miss'&&s.q.dock<3)return 'cold';if(result==='win'&&s.workWins>0)return 'warm';return s.rel.lu<=1?'cold':'neutral';}
 function reactions(before,after,action){if(!before||!after||before===after)return [];const a=action.type,events=[];const add=(who,mood,reason)=>events.push({who,mood,reason});
  if(a==='cafeAccept'&&before.q.cafe===0&&after.q.cafe===1)add('gu','neutral','开始认识');
  if(a==='cafeDeliver'&&before.q.cafe===1&&after.q.cafe===2&&after.rel.gu>before.rel.gu)add('gu','warm','收到胶带');
  if(a==='cafeHelp'&&before.q.cafe===2&&after.q.cafe===3)add('gu','warm','合作开摊');
  if(a==='cafeSell'&&before.q.cafe!==4&&after.q.cafe===4)add('gu','angry','线索被出售');
  if(a==='sleep'&&before.q.cafe===1&&after.q.cafe===5)add('gu','cold','已承诺的胶带逾期');
  if(a==='dockAccept'&&before.q.dock===0&&after.q.dock===1)add('lu','neutral','开始试工');
  if(a==='dockReview'&&before.q.dock===1&&after.q.dock===2)add('lu','warm','签下达标成绩');
  if(a==='dockReport'&&before.q.branch!=='report'&&after.q.branch==='report')add('lu','warm','如实登记');
  if(a==='dockHide'&&before.q.branch!=='hide'&&after.q.branch==='hide')add('lu','angry','记录被隐去');
  if(a==='dockFinish'&&before.q.dock===3&&after.q.dock===4)add('lu','warm','交付推荐信');
  if(a==='finishWork'&&before.pending&&before.pending.id===action.id&&!before.settled.includes(action.id)&&after.settled.includes(action.id)&&!after.pending)add('lu',after.workWins>before.workWins?'warm':'cold',after.workWins>before.workWins?'本班真实达标':'本班未达标');
  return events;
 }
 function advance(elapsed,delta,playing){return elapsed+(playing?Math.max(0,Math.min(delta,.25)):0);}
 function frameAt(elapsed,n,fps,once){return {index:Math.floor(Math.max(0,elapsed)*fps)%n,finished:!!once&&elapsed>=n/fps};}
 return {base,reactions,lastPerformance,advance,frameAt};
});
