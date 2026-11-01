import { pipeline,type FeatureExtractionPipeline } from '@xenova/transformers';
let extractor:Promise<FeatureExtractionPipeline>|undefined;
async function model(){if(!extractor)extractor=pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2') as Promise<FeatureExtractionPipeline>;return extractor;}
export async function embed(text:string):Promise<number[]>{const pipe=await model();const output=await pipe(text,{pooling:'mean',normalize:true});return Array.from(output.data as Float32Array);}
