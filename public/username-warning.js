// Explain username whitespace before submission, including pasted whitespace.
(()=>{
 function setup(){
  document.querySelectorAll('input[name="username"]').forEach(input=>{
   const warning=document.createElement('small');warning.id=(input.id||'mq-username')+'-space-warning';
   warning.setAttribute('role','alert');warning.hidden=true;
   warning.style.cssText='display:block;color:#b42318;font-size:0.875rem;margin-top:6px';
   input.after(warning);
   const described=input.getAttribute('aria-describedby');
   input.setAttribute('aria-describedby',[described,warning.id].filter(Boolean).join(' '));
   function validate(){
    const bad=/\s/u.test(input.value);
    let lang='en';try{lang=window.MediQueueI18n?.language?.()||localStorage.getItem('mediqueue_language')||sessionStorage.getItem('mediqueue_patient_language')||'en';}catch{}
    const messages={en:'Username cannot contain spaces. Use an underscore (_) instead, for example NUR_MUHD.',ms:'Nama pengguna tidak boleh mengandungi ruang. Gunakan garis bawah (_) seperti NUR_MUHD.',zh:'用户名不能包含空格。请使用下划线（_），例如 NUR_MUHD。',ta:'பயனர் பெயரில் இடைவெளி இருக்கக்கூடாது. அதற்குப் பதிலாக அடிக்கோடு (_) பயன்படுத்தவும். எடுத்துக்காட்டு: NUR_MUHD.'};
    const text=messages[lang]||messages.en;
    // Replace text node so older translation observers cannot restore stale text.
    warning.replaceChildren(document.createTextNode(bad?text:''));warning.hidden=!bad;warning.style.display=bad?"block":"none";
    input.setCustomValidity(bad?text:'');
    if(bad)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    return !bad;
   }
   input.addEventListener('input',validate);input.addEventListener('change',validate);input.addEventListener('invalid',validate);
   input.form?.addEventListener('submit',event=>{if(!validate()){event.preventDefault();event.stopImmediatePropagation();input.reportValidity();}},true);
   window.addEventListener('mediqueue-language-changed',validate);validate();
  });
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',setup):setup();
})();
