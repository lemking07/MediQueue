const form=document.getElementById('accountForm');
const message=document.getElementById('message');
let signup=false;
function mode(value){
  signup=value;
  document.getElementById('nameField').hidden=!signup;
  document.getElementById('confirmField').hidden=!signup;
  document.getElementById('switchPrompt').hidden=signup;
  document.getElementById('loginPrompt').hidden=!signup;
  document.getElementById('intro').textContent=signup?'Create your patient account.':'Welcome back. Please log in to continue.';
  form.elements.fullName.required=signup;
  form.elements.confirm.required=signup;
  form.elements.password.autocomplete=signup?'new-password':'current-password';
  document.getElementById('submit').textContent=signup?'Create account':'Log in';
  document.title=signup?'MediQueue | Sign up':'MediQueue | Patient login';
  message.textContent='';
}
document.getElementById('loginTab').onclick=()=>mode(false);
document.getElementById('signupTab').onclick=()=>mode(true);
form.addEventListener('submit',async e=>{
  e.preventDefault();message.textContent='';
  const fullName=form.elements.fullName.value;
  const username=form.elements.username.value;
  const password=form.elements.password.value;
  if(signup&&password!==form.elements.confirm.value){message.textContent='Passwords do not match.';return;}
  const submit=document.getElementById('submit');submit.disabled=true;
  try{
    const response=await fetch(signup?'/api/patient/signup':'/api/patient/login',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName,username,password})
    });
    const result=await response.json();
    if(!response.ok){message.textContent=result.error||'Unable to continue.';return;}
    localStorage.removeItem('mediqueue_patient_ticket');
    location.href='/patient.html';
  }catch{message.textContent='Connection error. Try again.';}
  finally{submit.disabled=false;}
});
fetch('/api/patient/me').then(r=>{if(r.ok)location.href='/patient.html';}).catch(()=>{});
