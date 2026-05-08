const container = Object.assign(document.createElement('div'),{className:'toast-container'});
document.body.appendChild(container);
export function toast(msg, type='info', dur=3200){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  const icons={success:'bi-check-circle-fill',error:'bi-x-circle-fill',info:'bi-info-circle-fill'};
  el.innerHTML=`<i class="bi ${icons[type]||icons.info}"></i><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(20px)';
    setTimeout(()=>el.remove(),300);},dur);
}
