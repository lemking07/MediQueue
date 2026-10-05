"use strict";
async function loadOverview(){
 const error=document.getElementById('error');error.textContent='';
 try{
  const response=await fetch('/api/admin/overview',{cache:'no-store'});
  if(response.status===401){location.replace('/staff-login.html');return;}
  if(!response.ok)throw new Error(response.status===403?'Administrator access required.':'Unable to load overview.');
  const data=await response.json();
  for(const [id,value] of Object.entries({departments:data.departments.length,waiting:data.waiting,serving:data.serving,staff:data.staff.total,pending:data.staff.pending}))document.getElementById(id).textContent=value;
  const rows=document.getElementById('rows');rows.replaceChildren();
  for(const d of data.departments){const tr=document.createElement('tr');for(const value of [d.name,d.open?'Open':'Closed',d.waiting,d.serving,d.rooms]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}rows.append(tr);}
 }catch(e){error.textContent=e.message;}
}
document.getElementById('refresh').addEventListener('click',loadOverview);
loadOverview();
