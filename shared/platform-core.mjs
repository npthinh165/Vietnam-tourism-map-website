// The browser sandbox and authenticated API use the same validation rules.
// Authorization here supplements (and never replaces) server-side token verification.
import { createInitialState } from './platform-seeds.mjs';
export { createInitialState };
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const text = (value, min = 0, max = 5000) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(`Nội dung cần từ ${min} đến ${max} ký tự.`);
  return value.trim();
};
const amount = (value, max = 1000000000) => { const n = Number(value ?? 0); if (!Number.isFinite(n) || n < 0 || n > max) fail('Số tiền không hợp lệ.'); return Math.round(n); };
const image = value => { if (!value) return ''; try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) fail('Ảnh cần là liên kết HTTPS công khai.'); return url.href; } catch { fail('Ảnh cần là liên kết HTTPS hợp lệ.'); } };
const images = value => { if (!Array.isArray(value) || value.length > 6) fail('Tối đa 6 ảnh cho mỗi nội dung.'); return value.map(image).filter(Boolean); };
const tags = value => { if (!Array.isArray(value) || value.length > 8) fail('Tối đa 8 thẻ chủ đề.'); return [...new Set(value.map(v => text(v, 1, 40)))]; };
const now = () => new Date().toISOString();
const id = () => globalThis.crypto.randomUUID();
const own = (item, actor) => { if (!item) fail('Không tìm thấy nội dung.',404); if (item.authorId !== actor.id) fail('Bạn chỉ có thể sửa nội dung của mình.',403); return item; };
const admin = actor => { if (actor.role !== 'admin') fail('Thao tác chỉ dành cho quản trị viên.',403); };
const group = (state, type) => ({post:state.posts,itinerary:state.itineraries,review:state.reviews,comment:state.comments}[type]);
const target = (state,type,targetId) => { const item = group(state,type)?.find(v=>v.id===targetId); if (!item) fail('Nội dung không còn tồn tại.',404); return item; };
const visible = (item, actor) => actor?.role === 'admin' || item.authorId === actor?.id || (item.status === 'approved' && item.visibility !== 'private');
const accessible = (state,type,targetId,actor) => { const item=target(state,type,targetId); if (type === 'comment') return accessible(state,item.targetType,item.targetId,actor); if (!visible(item,actor)) fail('Không có quyền truy cập nội dung này.',403); return item; };
function notify(state,userId,message,tab='',targetId='') {
  state.notifications.unshift({id:id(),userId,message,read:false,createdAt:now(),tab,targetId});
  state.notifications = state.notifications.slice(0,3000);
}
function profile(state,actor) {
  let item = state.profiles.find(v=>v.id===actor.id);
  if (!item) { item={id:actor.id,name:actor.name,bio:'',avatar:'',points:0,level:'Người khám phá',badges:[]}; state.profiles.push(item); }
  return item;
}
function syncReward(state,userId,source,desired,reason) {
  const current = state.points.filter(v=>v.userId===userId&&v.source===source).reduce((sum,v)=>sum+v.amount,0);
  if (desired===current) return;
  state.points.unshift({id:id(),userId,source,amount:desired-current,reason,createdAt:now()});
  notify(state,userId,`${desired-current>0?'+':''}${desired-current} điểm · ${reason}`,'profile');
}
function rewardFor(state,type,item) {
  const eligible = item.status==='approved' && item.visibility!=='private' && !item.demo;
  syncReward(state,item.authorId,`${type}:${item.id}`,eligible ? state.settings.points[type] : 0, eligible ? 'Đóng góp được duyệt' : 'Điều chỉnh điểm nội dung');
  if (type==='review') {
    const votes=state.reactions.filter(r=>r.targetType==='review'&&r.targetId===item.id&&r.userId!==item.authorId).length;
    syncReward(state,item.authorId,`helpful:${item.id}`,eligible ? Math.min(votes,50)*state.settings.points.helpful : 0,'Bình chọn đánh giá hữu ích');
  }
}
function updateAchievements(state) {
  for (const p of state.profiles) {
    const oldLevel=p.level;
    p.points=Math.max(0,state.points.filter(v=>v.userId===p.id).reduce((sum,v)=>sum+v.amount,0));
    const approved=[...state.posts,...state.itineraries,...state.reviews].filter(v=>v.authorId===p.id&&v.status==='approved'&&!v.demo&&v.visibility!=='private').length;
    p.level=p.points>=1000&&approved>=30?'Đại sứ du lịch':p.points>=500&&approved>=15?'Người kể chuyện':p.points>=200&&approved>=8?'Nhà thám hiểm':p.points>=50&&approved>=3?'Lữ khách':'Người khám phá';
    const mine=state.itineraries.filter(v=>v.authorId===p.id&&v.status==='approved'&&v.visibility==='public'&&!v.demo);
    p.badges=[];
    if (mine.length) p.badges.push('Lịch trình đầu tiên');
    if(state.reviews.filter(v=>v.authorId===p.id&&v.status==='approved'&&!v.demo).length>=5) p.badges.push('Người đánh giá có tâm');
    if(new Set(mine.map(v=>v.region)).size===3) p.badges.push('Nhà khám phá ba miền');
    if (oldLevel!==p.level) notify(state,p.id,`Cấp độ của bạn: ${p.level}`,'profile');
  }
}
function limit(state,type,actor,max=5) {
  const today=now().slice(0,10);
  // Deletions are recorded as tombstones so delete/recreate cannot bypass daily limits.
  const actions=(state.activityLog||[]).filter(v=>v.userId===actor.id&&v.type===type&&v.at.startsWith(today));
  if(actions.length>=max) fail('Bạn đã đạt giới hạn đóng góp hôm nay. Hãy quay lại vào ngày mai.',429);
  state.activityLog=[...(state.activityLog||[]).filter(v=>v.at>=new Date(Date.now()-86400000*8).toISOString()),{userId:actor.id,type,at:now()}];
}
function cleanDays(input) {
  if(!Array.isArray(input)||input.length<1||input.length>14) fail('Lịch trình cần từ 1 đến 14 ngày.');
  return input.map((day,index)=>{
    if(!Array.isArray(day.activities)||!day.activities.length||day.activities.length>12) fail('Mỗi ngày cần từ 1 đến 12 hoạt động.');
    return {day:index+1,title:text(day.title,1,120),activities:day.activities.map(a=>{
      const time=text(a.time||'',0,5); if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('Giờ hoạt động không hợp lệ.');
      const hasCoords=a.lat!==undefined&&a.lat!==''&&a.lng!==undefined&&a.lng!=='';
      if(hasCoords&&(!Number.isFinite(Number(a.lat))||!Number.isFinite(Number(a.lng))||Math.abs(Number(a.lat))>90||Math.abs(Number(a.lng))>180))fail('Tọa độ không hợp lệ.');
      return {id:id(),time,title:text(a.title,2,160),place:text(a.place||'',0,160),notes:text(a.notes||'',0,2000),transport:text(a.transport||'',0,80),cost:amount(a.cost),...(hasCoords?{lat:Number(a.lat),lng:Number(a.lng)}:{})};
    })};
  });
}
export function applyAction(original,action,actor) {
  if(!actor?.id||!['user','admin'].includes(actor.role))fail('Vui lòng đăng nhập để tiếp tục.',401);
  if(!action||typeof action.type!=='string'||!action.payload||Array.isArray(action.payload))fail('Yêu cầu không hợp lệ.');
  const state=structuredClone(original), p=action.payload, timestamp=now();
  profile(state,actor);
  switch(action.type) {
    case 'post.upsert': {
      const old=p.id?own(state.posts.find(v=>v.id===p.id),actor):null;
      if(!old)limit(state,'post',actor);
      const content=text(p.content,30,5000);
      if(state.posts.some(v=>v.id!==old?.id&&v.authorId===actor.id&&v.content===content))fail('Bạn đã chia sẻ nội dung này.');
      const status=p.status==='draft'?'draft':state.settings.requireModeration&&actor.role!=='admin'?'pending':'approved';
      if(p.itineraryId)accessible(state,'itinerary',p.itineraryId,actor);
      const item={id:old?.id||id(),authorId:actor.id,content,images:images(p.images||[]),province:text(p.province||'',0,100),region:text(p.region||'',0,20),tags:tags(p.tags||[]),itineraryId:p.itineraryId||'',status,createdAt:old?.createdAt||timestamp,updatedAt:timestamp};
      state.posts=[item,...state.posts.filter(v=>v.id!==item.id)]; rewardFor(state,'post',item);break;
    }
    case 'itinerary.upsert': {
      const old=p.id?own(state.itineraries.find(v=>v.id===p.id),actor):null;
      if(!old)limit(state,'itinerary',actor);
      if(!['Bắc','Trung','Nam'].includes(p.region))fail('Chọn miền cho lịch trình.');
      const visibility=p.visibility==='public'?'public':'private';
      const status=p.status==='draft'||visibility==='private'?'draft':state.settings.requireModeration&&actor.role!=='admin'?'pending':'approved';
      const item={id:old?.id||id(),authorId:actor.id,title:text(p.title,8,140),description:text(p.description,30,5000),cover:image(p.cover),origin:text(p.origin||'',0,120),destination:text(p.destination||p.province||'',1,120),province:text(p.province,1,100),region:p.region,days:cleanDays(p.days),budget:amount(p.budget),...(p.actualCost!==undefined?{actualCost:amount(p.actualCost)}:{}),transport:text(p.transport||'',0,160),tips:text(p.tips||'',0,3000),tags:tags(p.tags||[]),photos:images(p.photos||[]),visibility,status,createdAt:old?.createdAt||timestamp,updatedAt:timestamp,pinned:false,verified:false};
      state.itineraries=[item,...state.itineraries.filter(v=>v.id!==item.id)];rewardFor(state,'itinerary',item);break;
    }
    case 'itinerary.copy': {
      const source=accessible(state,'itinerary',p.id,actor);limit(state,'itinerary',actor);
      state.itineraries.unshift({...structuredClone(source),id:id(),authorId:actor.id,title:`Bản sao · ${source.title}`.slice(0,140),visibility:'private',status:'draft',demo:false,pinned:false,verified:false,createdAt:timestamp,updatedAt:timestamp});break;
    }
    case 'post.delete': case 'itinerary.delete': {
      const type=action.type.split('.')[0],list=group(state,type),item=own(list.find(v=>v.id===p.id),actor);
      item.status='rejected';rewardFor(state,type,item);state[type==='post'?'posts':'itineraries']=list.filter(v=>v.id!==item.id);
      state.comments=state.comments.filter(v=>!(v.targetType===type&&v.targetId===item.id));
      state.reactions=state.reactions.filter(v=>!(v.targetType===type&&v.targetId===item.id));
      state.saves=state.saves.filter(v=>!(v.targetType===type&&v.targetId===item.id));break;
    }
    case 'comment.create': {
      if(!['post','itinerary'].includes(p.targetType))fail('Loại bình luận không hợp lệ.');
      const parent=accessible(state,p.targetType,p.targetId,actor);limit(state,'comment',actor,30);
      const content=text(p.content,2,2000);
      if(state.comments.some(v=>v.authorId===actor.id&&v.targetId===p.targetId&&v.content===content))fail('Bạn đã gửi bình luận này.');
      if(p.parentId&&!state.comments.some(v=>v.id===p.parentId&&v.targetId===p.targetId&&v.targetType===p.targetType))fail('Bình luận gốc không tồn tại.');
      state.comments.push({id:id(),authorId:actor.id,targetType:p.targetType,targetId:p.targetId,parentId:p.parentId||undefined,content,createdAt:timestamp});
      if(parent.authorId!==actor.id)notify(state,parent.authorId,`${actor.name} đã bình luận về nội dung của bạn.`,p.targetType==='post'?'community':'planner',parent.id);break;
    }
    case 'comment.delete': { const item=state.comments.find(v=>v.id===p.id);if(actor.role!=='admin')own(item,actor);if(!item)fail('Không tìm thấy bình luận.',404); const removed=new Set([item.id]);let before;do{before=removed.size;state.comments.forEach(v=>{if(removed.has(v.parentId))removed.add(v.id);});}while(before!==removed.size);state.comments=state.comments.filter(v=>!removed.has(v.id));break; }
    case 'review.upsert': {
      const placeId=text(String(p.placeId),1,30);if(!/^\d+$/.test(placeId))fail('Địa điểm không hợp lệ.');
      const old=state.reviews.find(v=>v.authorId===actor.id&&v.placeId===placeId);
      const rating=Number(p.rating);if(!Number.isInteger(rating)||rating<1||rating>5)fail('Chọn từ 1 đến 5 sao.');
      if(!old)limit(state,'review',actor,8);
      if(p.visitedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.visitedAt)||p.visitedAt>timestamp.slice(0,10)))fail('Ngày trải nghiệm không hợp lệ.');
      const item={id:old?.id||id(),authorId:actor.id,placeId,placeName:text(p.placeName,1,150),rating,content:text(p.content,20,3000),images:images(p.images||[]),visitedAt:p.visitedAt||'',status:state.settings.requireModeration&&actor.role!=='admin'?'pending':'approved',createdAt:old?.createdAt||timestamp,updatedAt:timestamp};
      state.reviews=[item,...state.reviews.filter(v=>v.id!==item.id)];rewardFor(state,'review',item);break;
    }
    case 'reaction.toggle': {
      if(!['post','review'].includes(p.targetType))fail('Loại tương tác không hợp lệ.');
      const item=accessible(state,p.targetType,p.targetId,actor);if(item.authorId===actor.id)fail('Bạn không thể tự bình chọn nội dung của mình.');
      if(item.status!=='approved')fail('Chỉ bình chọn nội dung đã được duyệt.');
      const old=state.reactions.find(v=>v.userId===actor.id&&v.targetType===p.targetType&&v.targetId===p.targetId);
      state.reactions=state.reactions.filter(v=>v.id!==old?.id);
      if(!old) {state.reactions.push({id:id(),userId:actor.id,targetType:p.targetType,targetId:p.targetId});if(!state.notifications.some(n=>n.userId===item.authorId&&n.targetId===item.id&&n.message===`${actor.name} thấy đóng góp của bạn hữu ích.`))notify(state,item.authorId,`${actor.name} thấy đóng góp của bạn hữu ích.`,p.targetType==='post'?'community':'explore',item.id);}
      if(p.targetType==='review')rewardFor(state,'review',item);break;
    }
    case 'save.toggle': {
      if(!['post','itinerary','place'].includes(p.targetType))fail('Loại mục lưu không hợp lệ.');
      if(p.targetType!=='place')accessible(state,p.targetType,p.targetId,actor);
      const targetId=text(String(p.targetId),1,100),old=state.saves.find(v=>v.userId===actor.id&&v.targetType===p.targetType&&v.targetId===targetId);
      state.saves=state.saves.filter(v=>v.id!==old?.id);
      if(!old)state.saves.unshift({id:id(),userId:actor.id,targetType:p.targetType,targetId,title:text(p.title,1,160),notes:'',visited:false,budget:0,createdAt:timestamp});break;
    }
    case 'save.update': {
      const item=state.saves.find(v=>v.id===p.id&&v.userId===actor.id);if(!item)fail('Không tìm thấy mục trong sổ tay.',404);
      if(p.collectionId&&!state.collections.some(v=>v.id===p.collectionId&&v.userId===actor.id))fail('Bộ sưu tập không thuộc tài khoản này.');
      if(p.day!==undefined&&(!Number.isInteger(Number(p.day))||Number(p.day)<1||Number(p.day)>365))fail('Ngày trong hành trình không hợp lệ.');
      Object.assign(item,{notes:text(p.notes??item.notes,0,3000),visited:p.visited===undefined?item.visited:Boolean(p.visited),budget:amount(p.budget??item.budget),collectionId:p.collectionId??item.collectionId,day:p.day===undefined?item.day:Number(p.day)});break;
    }
    case 'collection.upsert': {
      const name=text(p.name,1,60);let item=p.id?state.collections.find(v=>v.id===p.id&&v.userId===actor.id):null;
      if(p.id&&!item)fail('Không tìm thấy bộ sưu tập.',404);
      if(state.collections.some(v=>v.userId===actor.id&&v.id!==item?.id&&v.name.toLowerCase()===name.toLowerCase()))fail('Tên bộ sưu tập đã tồn tại.');
      if(item)item.name=name;else{if(state.collections.filter(v=>v.userId===actor.id).length>=30)fail('Tối đa 30 bộ sưu tập.');state.collections.push({id:id(),userId:actor.id,name});}break;
    }
    case 'collection.delete': {
      const item=state.collections.find(v=>v.id===p.id&&v.userId===actor.id);if(!item)fail('Không tìm thấy bộ sưu tập.',404);
      state.collections=state.collections.filter(v=>v.id!==item.id);state.saves.forEach(v=>{if(v.collectionId===item.id)v.collectionId='';});break;
    }
    case 'profile.update': {const me=profile(state,actor);Object.assign(me,{name:text(p.name,2,80),bio:text(p.bio||'',0,500),avatar:image(p.avatar)});if(me.bio.length>=20)syncReward(state,actor.id,'profile',state.settings.points.profile,'Hoàn thiện hồ sơ');break;}
    case 'follow.toggle': {if(p.targetId===actor.id||!state.profiles.some(v=>v.id===p.targetId))fail('Thành viên không hợp lệ.');const exists=state.follows.some(v=>v.userId===actor.id&&v.targetId===p.targetId);state.follows=state.follows.filter(v=>!(v.userId===actor.id&&v.targetId===p.targetId));if(!exists){state.follows.push({userId:actor.id,targetId:p.targetId});notify(state,p.targetId,`${actor.name} đã theo dõi bạn.`,'profile');}break;}
    case 'report.create': {accessible(state,p.targetType,p.targetId,actor);if(state.reports.some(v=>v.authorId===actor.id&&v.targetType===p.targetType&&v.targetId===p.targetId&&v.status==='open'))fail('Bạn đã báo cáo nội dung này.');limit(state,'report',actor,10);state.reports.push({id:id(),authorId:actor.id,targetType:p.targetType,targetId:p.targetId,reason:text(p.reason,10,1000),status:'open',createdAt:timestamp});break;}
    case 'report.resolve': {admin(actor);const report=state.reports.find(v=>v.id===p.id);if(!report)fail('Không tìm thấy báo cáo.',404);report.status='resolved';break;}
    case 'moderation.review': {
      admin(actor);if(!['post','itinerary','review'].includes(p.targetType)||!['approved','rejected'].includes(p.status))fail('Quyết định kiểm duyệt không hợp lệ.');
      const item=target(state,p.targetType,p.targetId);if(item.visibility==='private'||item.status==='draft')fail('Không xuất bản bản nháp hoặc nội dung riêng tư.');
      if(item.demo)fail('Nội dung mẫu không được tính điểm hoặc xác minh.');
      item.status=p.status;item.updatedAt=timestamp;
      if(p.targetType==='itinerary'){item.pinned=Boolean(p.pinned)&&p.status==='approved';item.verified=Boolean(p.verified)&&p.status==='approved';item.verificationSource=item.verified?image(p.verificationSource):'';if(item.verified&&!item.verificationSource)fail('Cần nguồn xác minh trước khi gắn nhãn.');}
      rewardFor(state,p.targetType,item);notify(state,item.authorId,`Nội dung của bạn ${p.status==='approved'?'đã được duyệt':'không được duyệt'}.${p.reason?' '+text(p.reason,0,500):''}`,'profile');break;
    }
    case 'settings.update': {admin(actor);if(!p.points||typeof p.points!=='object')fail('Cấu hình điểm không hợp lệ.');for(const key of Object.keys(state.settings.points))if(p.points[key]!==undefined)state.settings.points[key]=amount(p.points[key],100);break;}
    case 'notifications.read': {state.notifications.forEach(v=>{if(v.userId===actor.id&&(!p.id||v.id===p.id))v.read=true;});break;}
    default: fail('Thao tác không được hỗ trợ.');
  }
  updateAchievements(state);state.version+=1;return state;
}
/** @param {any} original @param {{id:string,name:string,role:string}|null} actor */
export function publicSnapshot(original,actor=null) {
  const state=structuredClone(original);
  state.posts=state.posts.filter(v=>visible(v,actor));state.itineraries=state.itineraries.filter(v=>visible(v,actor));state.reviews=state.reviews.filter(v=>visible(v,actor));
  const allowed=(type,targetId)=>({post:state.posts,itinerary:state.itineraries,review:state.reviews}[type]||[]).some(v=>v.id===targetId);
  state.comments=state.comments.filter(v=>allowed(v.targetType,v.targetId));state.reactions=state.reactions.filter(v=>allowed(v.targetType,v.targetId));
  state.saves=state.saves.filter(v=>v.userId===actor?.id);state.collections=state.collections.filter(v=>v.userId===actor?.id);
  state.notifications=state.notifications.filter(v=>v.userId===actor?.id);state.points=state.points.filter(v=>actor?.role==='admin'||v.userId===actor?.id);
  state.reports=state.reports.filter(v=>actor?.role==='admin'||v.authorId===actor?.id);
  delete state.activityLog;return state;
}
