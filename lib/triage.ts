export type Urgency='ROUTINE'|'SOON'|'URGENT'|'EMERGENCY';
const rules:Array<{level:Urgency;score:number;pattern:RegExp;message:string}>=[
 {level:'EMERGENCY',score:100,pattern:/chest pain|pressure in (my )?chest|cannot breathe|can't breathe|severe shortness of breath|unconscious|not waking|face droop|sudden weakness|seizure|heavy bleeding|suicid(al|e)/i,message:'A potentially life-threatening symptom was mentioned.'},
 {level:'URGENT',score:75,pattern:/difficulty breathing|shortness of breath|faint(ed|ing)?|severe pain|high fever|vomit(ing)? blood|black stool|sudden vision loss/i,message:'A symptom requiring prompt clinical assessment was mentioned.'},
 {level:'SOON',score:45,pattern:/persistent pain|worsening pain|fever|infection|swelling|dizziness|blurred vision/i,message:'A symptom that may need timely assessment was mentioned.'}
];
export function assessUrgency(text:string):{urgency:Urgency;score:number;flags:string[]}{
 for(const r of rules)if(r.pattern.test(text))return {urgency:r.level,score:r.score,flags:[r.message]};
 return {urgency:'ROUTINE',score:text.trim()?15:0,flags:[]};
}
export const EMERGENCY_MESSAGE='This description may indicate an emergency. Do not wait for an online appointment: contact your local emergency number or go to the nearest emergency department now. If possible, ask someone to help you.';
