// The browser's native notification permission prompt is not used.
(() => {
  let pending = Promise.resolve();
  window.mqPatientDialog = options => {
    const result = pending.then(() => new Promise(resolve => {
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'mq-patient-dialog';
      const title = document.createElement('h2'); title.id = 'mq-patient-dialog-title'; title.textContent = options.title;
      const message = document.createElement('p'); message.id = 'mq-patient-dialog-message'; message.textContent = options.message;
      dialog.setAttribute('aria-labelledby',title.id); dialog.setAttribute('aria-describedby',message.id);
      const actions = document.createElement('div'); actions.className = 'mq-patient-dialog-actions';
      let finished = false;
      const finish = value => { if(finished)return; finished=true; dialog.close(); dialog.remove(); if(previous?.isConnected)previous.focus(); resolve(value); };
      if(options.cancel) { const cancel=document.createElement('button');cancel.type='button';cancel.textContent=options.cancel;cancel.className='mq-dialog-cancel';cancel.onclick=()=>finish(false);actions.append(cancel); }
      const accept=document.createElement('button');accept.type='button';accept.textContent=options.accept||'OK';accept.onclick=()=>finish(true);actions.append(accept);
      dialog.append(title,message,actions);document.body.append(dialog);
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false)});
      dialog.showModal(); (actions.querySelector('.mq-dialog-cancel')||accept).focus();
    }));
    pending = result.catch(() => {});
    return result;
  };
})();
