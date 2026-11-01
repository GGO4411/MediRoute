import 'dotenv/config';
import { ensureCollection,qdrant,COLLECTION,pointId } from '../lib/vector';
import { embed } from '../lib/embeddings';
const entries=[
 {id:'neuro-migraine',condition:'Migraine',description:'Recurrent headache often throbbing or one-sided, sometimes accompanied by nausea and sensitivity to light or sound.',specialty:'Neurology',keywords:['one-sided headache','light sensitivity','nausea','throbbing head pain']},
 {id:'ophth-eye',condition:'Eye irritation and ocular surface symptoms',description:'Eye redness, itching, gritty sensation, watering, or discomfort that may be associated with ocular surface problems.',specialty:'Ophthalmology',keywords:['red eye','itchy eyes','watery eyes','gritty sensation']},
 {id:'cardio-palpitations',condition:'Palpitations',description:'Awareness of heartbeat such as racing, pounding, fluttering, or skipped beats. New or severe symptoms need prompt assessment.',specialty:'Cardiology',keywords:['racing heart','fluttering heartbeat','pounding pulse']},
 {id:'derm-rash',condition:'Skin rash or dermatitis',description:'Itchy, inflamed, dry, scaly, or irritated skin patches that may reflect dermatitis or another skin condition.',specialty:'Dermatology',keywords:['itchy rash','red patches','dry skin','skin irritation']},
 {id:'ortho-joint',condition:'Joint and musculoskeletal pain',description:'Pain, stiffness, swelling, or reduced movement affecting joints, muscles, tendons, or bones.',specialty:'Orthopedics',keywords:['knee pain','joint stiffness','back pain','swollen joint']},
 {id:'ent-sinus',condition:'Nasal and sinus symptoms',description:'Nasal congestion, facial pressure, sinus discomfort, sore throat, or ear and hearing symptoms.',specialty:'ENT',keywords:['blocked nose','sinus pressure','ear pain','sore throat']},
 {id:'gastro-digestive',condition:'Digestive symptoms',description:'Abdominal discomfort, heartburn, bloating, nausea, constipation, diarrhoea, or changes in digestion.',specialty:'Gastroenterology',keywords:['stomach pain','acidity','bloating','diarrhoea']},
 {id:'pulmo-respiratory',condition:'Respiratory symptoms',description:'Persistent cough, wheezing, chest congestion, or recurring respiratory symptoms requiring clinical assessment.',specialty:'Pulmonology',keywords:['persistent cough','wheezing','chest congestion']},
 {id:'general-fever',condition:'Fever and general symptoms',description:'Fever, fatigue, weakness, headache, and non-specific symptoms that may need first assessment by a general physician.',specialty:'General Medicine',keywords:['fever','fatigue','weakness','body ache']},
 {id:'psych-sleep',condition:'Sleep and stress-related concerns',description:'Persistent sleep difficulty, stress, anxiety, or mood concerns that may benefit from a mental health professional.',specialty:'Psychiatry',keywords:['insomnia','anxiety','stress','low mood']}
];
async function main(){
 await ensureCollection();const points=[];
 for(const e of entries)points.push({id:pointId(e.id),vector:await embed(e.condition+'. '+e.description+'. Symptoms: '+e.keywords.join(', ')),payload:{...e,source:'demo-seed'}});
 await qdrant().upsert(COLLECTION,{wait:true,points});console.log('Indexed '+points.length+' routing concepts into '+COLLECTION+'.');
}
main().catch(e=>{console.error(e);process.exit(1);});
